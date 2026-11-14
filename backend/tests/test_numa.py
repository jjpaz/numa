import io
import json
import wave
from datetime import datetime, timezone, timedelta
import numpy as np
import pytest
from fastapi.testclient import TestClient
from backend.app import create_app
from backend.repository import Repository
from backend.security import verify_token, issue_token
from backend.domain import baseline_and_trend, recommend, patterns
from backend.analysis import acoustic_features, decode_audio, semantics

@pytest.fixture
def client(monkeypatch):
    for name in ['NUMA_PATIENT_PASSWORD','NUMA_SAMPLE_PASSWORD','NUMA_CLINICIAN_PASSWORD','DATABASE_URL']:
        monkeypatch.delenv(name,raising=False)
    return TestClient(create_app(repo=Repository(demo=True),demo=True,secret='a'*40))

def login(client,email='patient@numa.demo',password='journal-demo'):
    response=client.post('/api/auth/login',json={'email':email,'password':password})
    assert response.status_code==200,response.text
    return {'Authorization':'Bearer '+response.json()['token']}

def text_entry(client,headers,key='request-0001',text='I made some soup and looked out of the window.'):
    response=client.post('/api/patient/entries/text',headers=headers,json={'text':text,'request_id':key})
    assert response.status_code==200,response.text
    return client.get('/api/patient/entries/'+response.json()['id'],headers=headers).json()

def wav_bytes(samples):
    buff=io.BytesIO()
    with wave.open(buff,'wb') as w:
        w.setnchannels(1);w.setsampwidth(2);w.setframerate(16000);w.writeframes((samples*32767).astype('<i2').tobytes())
    return buff.getvalue()

def test_fresh_user_has_no_fictional_baseline(client):
    h=login(client)
    assert client.get('/api/patient/entries',headers=h).json()==[]
    insight=client.get('/api/patient/insights',headers=h).json()
    assert insight['trend']['days']==0
    assert not insight['trend']['ready']

def test_idempotency_edit_save_and_delete(client):
    h=login(client);first=text_entry(client,h)
    repeated=text_entry(client,h)
    assert first['id']==repeated['id']
    assert len(client.get('/api/patient/entries',headers=h).json())==1
    response=client.patch('/api/patient/entries/'+first['id'],headers=h,json={'transcript':'I went for a walk.','summary':'A short walk.','saved':True})
    assert response.status_code==200
    assert response.json()['explicit']==[]
    assert response.json()['summary']=='A short walk.'
    assert client.delete('/api/patient/entries/'+first['id'],headers=h).status_code==204
    assert client.get('/api/patient/entries/'+first['id'],headers=h).status_code==404

def test_clinic_cannot_access_private_journal(client):
    patient=login(client);entry=text_entry(client,patient,text='PRIVATE CANARY journal content')
    client.patch('/api/patient/entries/'+entry['id'],headers=patient,json={'saved':True})
    clinic=login(client,'psychologist@numa.demo','care-demo')
    assert client.get('/api/patient/entries',headers=clinic).status_code==403
    assert client.get('/api/patient/entries/'+entry['id'],headers=clinic).status_code==403
    assert client.patch('/api/patient/entries/'+entry['id'],headers=clinic,json={'saved':True}).status_code==403
    response=client.get('/api/clinic/patients',headers=clinic)
    assert response.status_code==200
    assert 'PRIVATE CANARY' not in response.text
    for forbidden in ['transcript','summary','explicit','probabilities','audio','tags']:
        assert f'"{forbidden}"' not in response.text
    assert client.get('/api/clinic/patients/not-assigned',headers=clinic).status_code==404

def test_patient_cannot_access_clinic_or_other_journal(client):
    h=login(client)
    assert client.get('/api/clinic/patients',headers=h).status_code==403
    assert client.patch('/api/clinic/patients/patient-live/notes',headers=h,json={'text':'x'}).status_code==403
    assert client.get('/api/patient/entries/seed-patient-sample-0',headers=h).status_code==404

def test_fictional_profiles_cannot_collect_real_baseline(client):
    h=login(client,'sample@numa.demo','sample-demo')
    assert client.post('/api/patient/entries/text',headers=h,json={'text':'real speech','request_id':'cannot-mix'}).status_code==403

def test_action_feedback_and_cross_session_visibility(client):
    h=login(client);entry=text_entry(client,h)
    path='/api/patient/entries/'+entry['id']
    assert client.post(path+'/action',headers=h,json={'kind':'walk','completed':True}).status_code==409
    client.patch(path,headers=h,json={'saved':True})
    assert client.post(path+'/action',headers=h,json={'kind':'walk','feedback':'helpful'}).status_code==409
    client.post(path+'/action',headers=h,json={'kind':'walk','completed':True,'feedback':'helpful'})
    assert client.get('/api/patient/insights',headers=h).json()['patterns'][0]['helpful']==1
    second=login(client)
    assert client.get(path,headers=second).json()['action']['feedback']=='helpful'
    clinic=login(client,'psychologist@numa.demo','care-demo')
    projected=client.get('/api/clinic/patients/patient-live',headers=clinic).json()
    assert projected['actions_completed']==1
    assert projected['patterns'][0]['helpful']==1

def test_notes_persist_and_do_not_enter_patient_payload(client):
    clinic=login(client,'psychologist@numa.demo','care-demo')
    assert client.patch('/api/clinic/patients/patient-live/notes',headers=clinic,json={'text':'Professional note only'}).status_code==200
    assert client.get('/api/clinic/patients/patient-live',headers=clinic).json()['notes']['text']=='Professional note only'
    h=login(client)
    assert 'Professional note only' not in client.get('/api/patient/insights',headers=h).text

def test_vocal_output_cannot_overwrite_explicit_self_report(client,monkeypatch):
    import backend.app as app_module
    captured=[]
    def semantic(text,demo):
        captured.append(text)
        return {'title':'A day','summary':text,'tags':[],'explicit':[{'feeling':'happy','evidence':'I feel happy'}],'semantic_source':'test'}
    monkeypatch.setattr(app_module,'semantics',semantic)
    monkeypatch.setattr(app_module,'transcribe',lambda data,mime:'I feel happy')
    monkeypatch.setattr(app_module,'analyse_voice',lambda data,demo:{'quality':'valid','source':'measured','model':'test-model','probabilities':{'sad':.9,'happy':.1},'features':{'duration_sec':4,'energy':.1,'pause_ratio':.2},'observation':'Experimental estimate'})
    h=login(client)
    response=client.post('/api/patient/entries/audio',headers=h,data={'request_id':'audio-conflict'},files={'audio':('speech.wav',b'example','audio/wav')})
    entry=client.get('/api/patient/entries/'+response.json()['id'],headers=h).json()
    assert entry['voice']['probabilities']['sad']==.9
    assert entry['explicit'][0]['feeling']=='happy'
    assert captured==['I feel happy']
    updated=client.patch('/api/patient/entries/'+entry['id'],headers=h,json={'transcript':'I feel happy today','saved':True}).json()
    assert updated['voice']==entry['voice']

def test_no_invented_explicit_feelings(monkeypatch):
    import backend.analysis as analysis
    monkeypatch.setattr(analysis,'gemini',lambda *args,**kwargs:{'title':'Day','summary':'Cooked soup','tags':['cooking'],'explicit':[{'feeling':'sad','evidence':'I am sad'}]})
    assert semantics('I made soup.',False)['explicit']==[]
    assert semantics('I made soup.',True)['explicit']==[]

def test_partial_failure_still_saves_private_words(client,monkeypatch):
    import backend.app as app_module
    def fail(*args,**kwargs): raise RuntimeError('provider offline')
    monkeypatch.setattr(app_module,'semantics',fail)
    h=login(client);entry=text_entry(client,h)
    assert entry['status']=='failed'
    response=client.patch('/api/patient/entries/'+entry['id'],headers=h,json={'transcript':'A corrected thought.','saved':True})
    assert response.status_code==200
    assert response.json()['saved']
    assert response.json()['explicit']==[]

def test_quality_checks_and_real_acoustic_measurement():
    t=np.arange(16000*4)/16000
    valid=.1*np.sin(t*2*np.pi*180)
    result=acoustic_features(decode_audio(wav_bytes(valid)))
    assert result['quality']=='valid'
    assert result['features']['duration_sec']==4
    assert .06<result['features']['energy']<.08
    assert acoustic_features(np.zeros(64000))['quality']=='insufficient_audio'
    assert acoustic_features(np.ones(64000))['quality']=='insufficient_audio'
    assert acoustic_features(valid[:100])['quality']=='insufficient_audio'

def test_gemini_receives_normalized_wav_not_browser_codec_mime(monkeypatch):
    import backend.analysis as analysis
    captured=[]
    def fake_gemini(prompt,audio=None,**kwargs):
        captured.append(audio)
        return {'transcript':'An ordinary day.'}
    monkeypatch.setattr(analysis,'gemini',fake_gemini)
    data=wav_bytes(.08*np.sin(np.arange(64000)/16000*2*np.pi*200))
    assert analysis.transcribe(data,'audio/webm;codecs=opus')=='An ordinary day.'
    assert captured[0][1]=='audio/wav'
    with wave.open(io.BytesIO(captured[0][0])) as w:
        assert w.getframerate()==16000 and w.getnchannels()==1

def test_audio_partial_failure_idempotency_and_followup(client):
    h=login(client)
    samples=.08*np.sin(np.arange(64000)/16000*2*np.pi*200)
    data=wav_bytes(samples)
    def upload(): return client.post('/api/patient/entries/audio',headers=h,data={'request_id':'real-acoustics'},files={'audio':('speech.wav',data,'audio/wav')})
    response=upload();key=response.json()['id'];entry=client.get('/api/patient/entries/'+key,headers=h).json()
    assert entry['voice']['quality']=='valid'
    assert entry['voice']['ml_status']=='not_configured'
    assert entry['status']=='completed'
    assert upload().json()['id']==key
    client.patch('/api/patient/entries/'+key,headers=h,json={'transcript':'Some words.','saved':True})
    client.post('/api/patient/entries/'+key+'/action',headers=h,json={'kind':'walk','completed':True})
    follow=client.post('/api/patient/entries/'+key+'/follow-up',headers=h,files={'audio':('after.wav',data,'audio/wav')})
    assert follow.status_code==200
    result=client.get('/api/patient/entries/'+key,headers=h).json()
    assert result['follow_up']['voice']['quality']=='valid'
    assert 'helped' in result['follow_up']['interpretation']
    assert baseline_and_trend([result])['days']==1

def test_baseline_requires_distinct_days_and_three_later_changes():
    entries=[]
    for i in range(8):
        date=(datetime(2026,11,1,tzinfo=timezone.utc)+timedelta(days=i)).isoformat()
        entries.append({'id':str(i),'created_at':date,'saved':True,'voice':{'quality':'valid','features':{'energy':.06 if i<5 else .005,'pause_ratio':.2 if i<5 else .6}}})
    assert not baseline_and_trend(entries[:4])['ready']
    assert not baseline_and_trend(entries[:7])['persistent_change']
    assert baseline_and_trend(entries)['persistent_change']
    same_day=[{**e,'created_at':entries[0]['created_at']} for e in entries]
    assert baseline_and_trend(same_day)['days']==1
    entries[-1]['saved']=False
    assert not baseline_and_trend(entries)['persistent_change']

def test_sessions_are_signed_and_expired_tokens_rejected(client,monkeypatch):
    assert client.get('/api/patient/entries').status_code==401
    assert client.get('/api/patient/entries',headers={'Authorization':'Bearer forged'}).status_code==401
    token=issue_token('patient-live','a'*40)
    assert verify_token(token,'a'*40)=='patient-live'
    with pytest.raises(Exception): verify_token(token,'b'*40)
    monkeypatch.setattr('backend.security.time.time',lambda:99999999999)
    with pytest.raises(Exception): verify_token(token,'a'*40)

def test_production_requires_postgresql_and_secret(monkeypatch):
    with pytest.raises(RuntimeError):create_app(demo=False,secret='weak')
    with pytest.raises(RuntimeError):Repository(demo=False)
    with pytest.raises(ValueError):Repository('sqlite:///extra.db')

def test_clinical_sample_shows_demonstrable_pattern(client):
    h=login(client,'psychologist@numa.demo','care-demo')
    response=client.get('/api/clinic/patients/patient-sample',headers=h).json()
    assert response['source']=='simulated'
    assert response['trend']['persistent_change']
    assert response['status']=='review'

def test_stale_jobs_recover_for_manual_save(client):
    h=login(client);entry=text_entry(client,h)
    entry.update(status='processing',analysis={'status':'processing','errors':[],'updated_at':'2020-01-01T00:00:00+00:00'})
    client.app.state.repo.put('entries',entry['id'],entry,entry['patient_id'])
    recovered=client.get('/api/patient/entries/'+entry['id'],headers=h).json()
    assert recovered['status']=='failed'
    assert 'interrupted' in recovered['analysis']['errors'][0]
    assert client.patch('/api/patient/entries/'+entry['id'],headers=h,json={'saved':True}).status_code==200

def test_preference_filter_and_feedback_evidence():
    entries=[{'saved':True,'context':{'sleep_hours':6},'action':{'kind':'music','feedback':'helpful'}}]
    result=recommend(entries,['music'],{'sleep_hours':6.5})
    assert result['kind']=='music'
    assert result['evidence_count']==1
    assert '1 of 1' in result['reason']
    assert 'similar sleep' in result['reason']
    assert recommend(entries,['breathe'],{'sleep_hours':6})['kind']=='breathe'

@pytest.mark.skipif(not __import__('os').getenv('TEST_DATABASE_URL'),reason='A dedicated PostgreSQL test URL is not configured')
def test_postgresql_persistence():
    import os,secrets
    from backend.repository import dedicated_test_url
    repo=Repository(dedicated_test_url());key='test-'+secrets.token_hex(8)
    try:
        repo.put('verification',key,{'value':'persists'},'test')
        assert Repository(os.environ['TEST_DATABASE_URL']).get('verification',key)=={'value':'persists'}
    finally:repo.delete('verification',key)
