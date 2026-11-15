import base64
import json

import pytest
from fastapi.testclient import TestClient

from backend.app import create_app
from backend.repository import Repository
from backend.security import issue_token
from backend.tests.test_numa import text_entry
from backend.tests.test_storage_resilience import FakePostgres, forbidden_keys


def app_client(monkeypatch, enabled=True, demo=True):
    monkeypatch.setenv('NUMA_DEMO_NAME_LOGIN', 'true' if enabled else 'false')
    if not demo:
        for key in ('NUMA_PATIENT_PASSWORD', 'NUMA_SAMPLE_PASSWORD', 'NUMA_CLINICIAN_PASSWORD', 'GEMINI_API_KEY', 'GEMINI_MODEL'):
            monkeypatch.setenv(key, 'test-only-configuration')
    return TestClient(create_app(repo=Repository(demo=True), demo=demo, secret='a'*40))


def headers(response):
    assert response.status_code == 200
    return {'Authorization': 'Bearer '+response.json()['token']}


def test_named_sessions_keep_names_separate_and_roles_enforced(monkeypatch):
    client = app_client(monkeypatch)
    first = client.post('/api/auth/demo', json={'name': '  Demo One  ', 'role': 'patient'})
    second = client.post('/api/auth/demo', json={'name': 'Demo Two', 'role': 'patient'})
    h = headers(first)
    first_id = first.json()['user']['id']
    second_id = second.json()['user']['id']
    assert first_id != second_id
    assert first_id != 'patient-live'
    assert first.json()['user']['name'] == 'Demo One'
    assert client.get('/api/auth/me', headers=h).json()['name'] == 'Demo One'
    assert client.get('/api/auth/me', headers=headers(second)).json()['name'] == 'Demo Two'
    assert client.app.state.repo.get('users', 'patient-live')['name'] == 'Alex Morgan'
    assert client.patch('/api/patient/preferences', headers=h, json={'actions': ['walk']}).status_code == 200
    assert client.app.state.repo.get('users', first_id)['preferences'] == ['walk']
    assert client.app.state.repo.get('users', second_id)['preferences'] == ['walk','music','breathe','connect']
    assert client.app.state.repo.get('users', 'patient-live')['name'] == 'Alex Morgan'
    assert client.get('/api/clinic/patients', headers=h).status_code == 403
    clinician = headers(client.post('/api/auth/demo', json={'name': 'Demo Clinician', 'role': 'psychologist'}))
    assert client.get('/api/patient/entries', headers=clinician).status_code == 403
    assert client.get('/api/clinic/patients', headers=clinician).status_code == 200
    sample = headers(client.post('/api/auth/demo', json={'name': 'Demo Reader', 'role': 'patient', 'sample': True}))
    assert client.post('/api/patient/entries/text', headers=sample, json={'text': 'Fictional note', 'request_id': 'sample-denial'}).status_code == 403
    body, signature = first.json()['token'].split('.')
    claims = json.loads(base64.urlsafe_b64decode(body+'='*(-len(body)%4)))
    claims['sub'] = 'psychologist'
    forged = base64.urlsafe_b64encode(json.dumps(claims).encode()).decode().rstrip('=')+'.'+signature
    assert client.get('/api/clinic/patients', headers={'Authorization': 'Bearer '+forged}).status_code == 401


def test_saved_named_patient_appears_to_existing_clinician_without_private_words(monkeypatch):
    client = app_client(monkeypatch)
    clinic = headers(client.post('/api/auth/demo', json={'name':'Dr. Demo','role':'psychologist'}))
    first = client.post('/api/auth/demo', json={'name':'Hola','role':'patient'})
    second = client.post('/api/auth/demo', json={'name':'Other demo','role':'patient'})
    first_id = first.json()['user']['id']
    h, other = headers(first), headers(second)
    # Both users may generate the same request ID without sharing an entry.
    entry = text_entry(client, h, key='named-patient-save', text='PRIVATE named patient words')
    other_entry = text_entry(client, other, key='named-patient-save')
    assert entry['id'] != other_entry['id']
    path = '/api/patient/entries/' + entry['id']
    for method in ('get','patch','delete'):
        options = {'json':{'saved':True}} if method == 'patch' else {}
        assert getattr(client, method)(path, headers=other, **options).status_code == 404
    projection = client.get('/api/clinic/patients/' + first_id, headers=clinic).json()
    assert projection['entry_count'] == 0  # Drafts are not shared observations.
    assert client.patch(path, headers=h, json={'saved':True}).status_code == 200
    response = client.get('/api/clinic/patients', headers=clinic)
    assert response.status_code == 200
    rows = {row['id']:row for row in response.json()}
    assert rows[first_id]['name'] == 'Hola'
    assert rows[first_id]['entry_count'] == 1
    assert rows[first_id]['last_entry_at'] == entry['created_at']
    assert rows[second.json()['user']['id']]['entry_count'] == 0
    assert rows['patient-live']['entry_count'] == 0
    assert 'PRIVATE named patient words' not in response.text
    forbidden_keys(response.json())
    assert client.get(path, headers=clinic).status_code == 403


def test_named_profile_survives_restart_and_normalized_login_without_duplicates(monkeypatch):
    monkeypatch.setenv('NUMA_DEMO_NAME_LOGIN','true')
    database = {}
    first_repo = FakePostgres(database)
    client = TestClient(create_app(repo=first_repo,demo=True,secret='a'*40))
    first = client.post('/api/auth/demo',json={'name':'  Hóla   Demo  ','role':'patient'})
    h = headers(first)
    uid = first.json()['user']['id']
    assert first.json()['user']['name'] == 'Hóla Demo'
    entry = text_entry(client,h,key='x'*80)
    assert len(entry['id']) <= 128
    assert client.patch('/api/patient/entries/'+entry['id'],headers=h,json={'saved':True}).status_code == 200
    first_repo.close()
    restarted = FakePostgres(database)
    # A signing-secret rotation must not orphan the name-based profile.
    client = TestClient(create_app(repo=restarted,demo=True,secret='b'*40))
    again = client.post('/api/auth/demo',json={'name':'HO\u0301LA\tDEMO','role':'patient'})
    assert again.json()['user']['id'] == uid
    assert again.json()['user']['name'] == 'Hóla Demo'
    entries = client.get('/api/patient/entries',headers=headers(again)).json()
    assert len(entries) == 1 and entries[0]['saved']
    assert entries[0]['id'] == entry['id']
    assert restarted.get('users','psychologist')['assigned'].count(uid) == 1


def test_legacy_named_session_requires_login_without_moving_shared_history(monkeypatch):
    client = app_client(monkeypatch)
    legacy_password = {'Authorization':'Bearer '+issue_token('patient-live','a'*40)}
    entry = text_entry(client,legacy_password,key='legacy-shared-history')
    path = '/api/patient/entries/'+entry['id']
    assert client.patch(path,headers=legacy_password,json={'saved':True}).status_code == 200
    legacy_named = {'Authorization':'Bearer '+issue_token('patient-live','a'*40,display_name='Hola')}
    assert client.get('/api/auth/me',headers=legacy_named).status_code == 401
    assert client.post('/api/patient/entries/text',headers=legacy_named,json={
        'text':'Must not reach the old shared account','request_id':'legacy-denied',
    }).status_code == 401
    fresh = headers(client.post('/api/auth/demo',json={'name':'Hola','role':'patient'}))
    assert client.get('/api/patient/entries',headers=fresh).json() == []
    assert client.get(path,headers=fresh).status_code == 404
    assert client.get(path,headers=legacy_password).json()['saved']


def test_named_login_cannot_choose_a_seeded_role_or_sample_identity(monkeypatch):
    client = app_client(monkeypatch)
    for name in ('psychologist','patient-sample','Robin Ellis','Alex Morgan'):
        response = client.post('/api/auth/demo',json={'name':name,'role':'patient'})
        user = response.json()['user']
        assert user['role'] == 'patient' and user['source'] == 'live'
        assert user['id'] not in ('psychologist','patient-sample','patient-live')
        assert client.get('/api/clinic/patients',headers=headers(response)).status_code == 403


@pytest.mark.parametrize('payload', [
    {'name': '', 'role': 'patient'},
    {'name': '   ', 'role': 'patient'},
    {'name': 'x'*81, 'role': 'patient'},
    {'name': '\ufb03'*80, 'role': 'patient'},  # NFKC expands past the name limit.
    {'name': 'Demo', 'role': 'admin'},
    {'name': 'Demo', 'role': 'psychologist', 'sample': True},
])
def test_demo_login_rejects_invalid_input(monkeypatch, payload):
    assert app_client(monkeypatch).post('/api/auth/demo', json=payload).status_code == 422


@pytest.mark.parametrize('enabled,demo', [(False, True), (False, False), (True, False)])
def test_demo_access_follows_explicit_switch_in_connected_mode(monkeypatch, enabled, demo):
    client = app_client(monkeypatch, enabled, demo)
    assert client.get('/api/health').json()['demo_name_login'] is enabled
    assert client.post('/api/auth/demo', json={'name': 'Demo', 'role': 'patient'}).status_code == (200 if enabled else 404)
