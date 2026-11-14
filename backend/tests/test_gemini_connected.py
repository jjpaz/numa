"""Provider contracts with HTTP mocks. No live Gemini/clinical accuracy claim."""
import json
from types import SimpleNamespace

import httpx
import numpy as np
import pytest
from fastapi.testclient import TestClient

from backend import analysis
from backend.app import create_app
from backend.repository import Repository
from backend.tests.test_numa import wav_bytes


@pytest.fixture
def configured(monkeypatch):
    for name,value in {'GEMINI_API_KEY':'fake-key-only-for-tests','GEMINI_MODEL':'test-audio-json-model',
        'NUMA_PATIENT_PASSWORD':'test-patient-only','NUMA_SAMPLE_PASSWORD':'test-sample-only',
        'NUMA_CLINICIAN_PASSWORD':'test-clinician-only','NUMA_ML_ENABLED':'false','NUMA_SEED_DEMO':'false'}.items():
        monkeypatch.setenv(name,value)


def mock_http(monkeypatch,handler):
    client=httpx.Client
    monkeypatch.setattr(analysis,'httpx',SimpleNamespace(Timeout=httpx.Timeout,
        Client=lambda **kwargs:client(transport=httpx.MockTransport(handler),**kwargs)))


def response(value):
    return httpx.Response(200,json={'candidates':[{'finishReason':'STOP','content':{'parts':[{'text':json.dumps(value)}]}}]})


def patient_client():
    client=TestClient(create_app(repo=Repository(demo=True),demo=False,secret='test-session-secret-at-least-32-characters'))
    auth=client.post('/api/auth/login',json={'email':'patient@numa.demo','password':'test-patient-only'})
    assert auth.status_code==200
    return client,{'Authorization':'Bearer '+auth.json()['token']}


def test_list_models_pagination_and_secret_only_in_header(monkeypatch,configured):
    calls=[]
    def handler(request):
        calls.append(request)
        assert 'fake-key' not in str(request.url)
        assert request.headers['x-goog-api-key']=='fake-key-only-for-tests'
        if request.url.params.get('pageToken')=='next':
            return httpx.Response(200,json={'models':[{'name':'models/model-b','supportedGenerationMethods':['generateContent']}]})
        return httpx.Response(200,json={'models':[{'name':'models/model-a','supportedGenerationMethods':['generateContent']},
            {'name':'models/embedding','supportedGenerationMethods':['embedContent']}],'nextPageToken':'next'})
    mock_http(monkeypatch,handler)
    assert analysis.list_gemini_models()==['model-a','model-b']
    assert len(calls)==2


def test_audio_json_transcription_then_text_only_summary(monkeypatch,configured):
    calls=[]
    def handler(request):
        payload=json.loads(request.content);calls.append(payload)
        assert payload['generationConfig']['responseMimeType']=='application/json'
        assert 'responseJsonSchema' in payload['generationConfig']
        if len(calls)==1:
            assert payload['contents'][0]['parts'][1]['inline_data']['mime_type']=='audio/wav'
            return response({'transcript':'I feel calm today.'})
        assert all('inline_data' not in part for part in payload['contents'][0]['parts'])
        return response({'title':'Today','summary':'A calm day.','tags':[],
            'explicit':[{'feeling':'calm','evidence':'I feel calm'}]})
    mock_http(monkeypatch,handler)
    transcript=analysis.transcribe(wav_bytes(.08*np.sin(np.arange(64000)/8)),'audio/mp4')
    assert transcript=='I feel calm today.'
    assert analysis.semantics(transcript)['explicit']==[{'feeling':'calm','evidence':'I feel calm'}]


@pytest.mark.parametrize('mode',['timeout','quota','invalid_json'])
def test_provider_failure_still_allows_save_and_summary_edits(monkeypatch,configured,mode):
    def handler(request):
        if mode=='timeout':raise httpx.ReadTimeout('PRIVATE-provider-details',request=request)
        if mode=='quota':return httpx.Response(429,json={'error':{'message':'PRIVATE-provider-details'}})
        return httpx.Response(200,json={'candidates':[{'content':{'parts':[{'text':'not JSON PRIVATE'}]}}]})
    mock_http(monkeypatch,handler)
    client,headers=patient_client()
    result=client.post('/api/patient/entries/audio',headers=headers,data={'request_id':'provider-failure-'+mode.replace('_','-')},
        files={'audio':('test.wav',wav_bytes(.08*np.sin(np.arange(64000)/8)),'audio/wav')})
    assert result.status_code==200
    path='/api/patient/entries/'+result.json()['id']
    entry=client.get(path,headers=headers).json()
    assert entry['voice']['ml_status']=='not_configured'
    assert entry['analysis']['errors'] and 'PRIVATE' not in str(entry['analysis'])
    saved=client.patch(path,headers=headers,json={'transcript':'Manually corrected words.','summary':'Edited summary.','saved':True})
    assert saved.status_code==200 and saved.json()['saved']
    assert saved.json()['summary']=='Edited summary.' and saved.json()['explicit']==[]


def test_transcript_survives_summary_failure_and_edit_only_reanalyses_text(monkeypatch,configured):
    import backend.app as module
    calls=[]
    def handler(request):
        payload=json.loads(request.content);calls.append(payload)
        if len(calls)==1:return response({'transcript':'These are real transcribed words from a mock.'})
        return httpx.Response(429,json={'error':{'message':'PRIVATE'}})
    mock_http(monkeypatch,handler)
    client,headers=patient_client()
    created=client.post('/api/patient/entries/audio',headers=headers,data={'request_id':'summary-only-failure'},
        files={'audio':('test.wav',wav_bytes(.08*np.sin(np.arange(64000)/8)),'audio/wav')}).json()
    path='/api/patient/entries/'+created['id'];entry=client.get(path,headers=headers).json()
    assert entry['transcript']=='These are real transcribed words from a mock.'
    assert entry['summary']==entry['transcript'] and entry['explicit']==[]
    voice=entry['voice']
    monkeypatch.setattr(module,'transcribe',lambda *a:pytest.fail('Editing must not transcribe again'))
    monkeypatch.setattr(module,'analyse_voice',lambda *a:pytest.fail('Editing must not analyse voice'))
    saved=client.patch(path,headers=headers,json={'transcript':'Edited words.','summary':'Manual summary.','saved':True}).json()
    assert saved['saved'] and saved['voice']==voice
    assert len(calls)==3
    assert all('inline_data' not in p for p in calls[-1]['contents'][0]['parts'])


@pytest.mark.parametrize('text,feeling,evidence,expected',[
    ('I cooked soup.','sad','I cooked soup',False),
    ('I feel calm today.','calm','I feel calm',True),
    ('I am happy.','happy','I am happy',True),
    ('I do not feel sad.','sad','I do not feel sad',False),
    ('My friend is sad.','sad','My friend is sad',False),
    ('If I felt sad, I would call.','sad','I felt sad',False),
    ('She said "I feel sad".','sad','I feel sad',False),
    ('An ordinary day.','sad','I feel sad',False),
])
def test_no_inferred_feelings_and_only_literal_first_person_evidence(text,feeling,evidence,expected,monkeypatch):
    monkeypatch.setattr(analysis,'gemini',lambda *a,**k:{'title':'Day','summary':'Summary','tags':[],
        'explicit':[{'feeling':feeling,'evidence':evidence}]})
    result=analysis.semantics(text)
    assert bool(result['explicit']) is expected
    for item in result['explicit']:assert item['evidence'] in text


def test_invalid_model_and_invalid_response_shape_fail_closed(monkeypatch,configured):
    monkeypatch.setenv('GEMINI_MODEL','not/a/model?key=PRIVATE')
    with pytest.raises(analysis.GeminiUnavailable,match='Choose and verify'):analysis.gemini('test')
    monkeypatch.setattr(analysis,'gemini',lambda *a,**k:{'summary':[],'explicit':'invalid'})
    with pytest.raises(analysis.GeminiUnavailable):analysis.semantics('No declaration.')
