import base64
import json

import pytest
from fastapi.testclient import TestClient

from backend.app import create_app
from backend.repository import Repository


def app_client(monkeypatch, enabled=True, demo=True):
    monkeypatch.setenv('NUMA_DEMO_NAME_LOGIN', 'true' if enabled else 'false')
    if not demo:
        for key in ('NUMA_PATIENT_PASSWORD', 'NUMA_SAMPLE_PASSWORD', 'NUMA_CLINICIAN_PASSWORD', 'GEMINI_API_KEY'):
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
    assert first.json()['user']['name'] == 'Demo One'
    assert client.get('/api/auth/me', headers=h).json()['name'] == 'Demo One'
    assert client.get('/api/auth/me', headers=headers(second)).json()['name'] == 'Demo Two'
    assert client.app.state.repo.get('users', 'patient-live')['name'] == 'Alex Morgan'
    assert client.patch('/api/patient/preferences', headers=h, json={'actions': ['walk']}).status_code == 200
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


@pytest.mark.parametrize('payload', [
    {'name': '', 'role': 'patient'},
    {'name': '   ', 'role': 'patient'},
    {'name': 'x'*81, 'role': 'patient'},
    {'name': 'Demo', 'role': 'admin'},
    {'name': 'Demo', 'role': 'psychologist', 'sample': True},
])
def test_demo_login_rejects_invalid_input(monkeypatch, payload):
    assert app_client(monkeypatch).post('/api/auth/demo', json=payload).status_code == 422


@pytest.mark.parametrize('enabled,demo', [(False, True), (True, False)])
def test_demo_access_is_disabled_without_both_switches(monkeypatch, enabled, demo):
    client = app_client(monkeypatch, enabled, demo)
    assert client.get('/api/health').json()['demo_name_login'] is False
    assert client.post('/api/auth/demo', json={'name': 'Demo', 'role': 'patient'}).status_code == 404
