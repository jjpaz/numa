"""Mocked PostgreSQL failure/restart contracts; not live Aiven evidence."""
import copy
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError, TimeoutError

from backend.app import create_app
from backend.repository import Repository, StorageUnavailable, dedicated_test_url, validate_database_url
from backend.tests.test_numa import login, text_entry


class FakePostgres(Repository):
    def __init__(self, database=None):
        super().__init__(demo=True)
        self.engine=SimpleNamespace(dispose=lambda:None)
        self.database={} if database is None else database
        self.offline=False

    def _check(self):
        if self.offline:raise TimeoutError('DO-NOT-LEAK-private-database-details')

    def _db_put(self,c,k,v,o):
        self._check();self.database[(c,k)]=(o,copy.deepcopy(v))

    def _db_get(self,c,k):
        self._check();return copy.deepcopy(self.database.get((c,k)))

    def _db_all(self,c,o):
        self._check()
        return {k:copy.deepcopy(r) for (kind,k),r in self.database.items() if kind==c and (o is None or r[0]==o)}

    def _db_delete(self,c,k):
        self._check();self.database.pop((c,k),None)


@pytest.mark.parametrize('url', ['sqlite:///extra.db','postgresql://u:p@host/db',
    'postgresql://u:p@host/db?sslmode=disable','postgresql://u:p@host/db?sslmode=prefer'])
def test_reject_non_postgresql_or_non_tls_configuration(url):
    with pytest.raises(ValueError):validate_database_url(url)


def test_test_database_must_differ_even_with_another_user(monkeypatch):
    monkeypatch.setenv('DATABASE_URL','postgresql://user:dummy@HOST/prod?sslmode=require')
    monkeypatch.setenv('TEST_DATABASE_URL','postgresql+psycopg://other:dummy@host:5432/prod?sslmode=verify-full')
    with pytest.raises(ValueError,match='different database'):dedicated_test_url()
    monkeypatch.setenv('TEST_DATABASE_URL','postgresql://user:dummy@host/numa_test?sslmode=require')
    assert dedicated_test_url()


def test_outage_keeps_words_flags_pending_and_recovers_without_owner_leak():
    repo=FakePostgres()
    repo.put('entries','other',{'id':'other','transcript':'OTHER-PRIVATE'},'other')
    repo.offline=True
    result=repo.put('entries','mine',{'id':'mine','transcript':'MY-PRIVATE','saved':True},'mine')
    assert result['persistence_status']=='pending_retry'
    assert 'restart' in result['persistence_warning'].lower()
    assert repo.get('entries','mine')['saved']
    assert [x['id'] for x in repo.all('entries','mine')]==['mine']
    assert [x['id'] for x in repo.all('entries','other')]==['other']
    repo.offline=False
    assert repo.get('entries','mine')['persistence_status']=='persisted'
    assert not repo.pending
    restarted=FakePostgres(repo.database)
    assert restarted.get('entries','mine')['transcript']=='MY-PRIVATE'
    assert 'persistence_warning' not in restarted.get('entries','mine')


def test_new_entry_during_outage_does_not_overwrite_uncached_existing_record():
    repo=FakePostgres({('entries','retry'):('mine',{'id':'retry','transcript':'original'})})
    repo.offline=True
    assert repo.get('entries','retry') is None
    repo.put('entries','retry',{'id':'retry','transcript':'new temporary words'},'mine')
    repo.offline=False
    assert repo.get('entries','retry')['persistence_status']=='conflict'
    assert repo.database[('entries','retry')][1]['transcript']=='original'
    assert repo.get('entries','retry')['transcript']=='new temporary words'


def test_outage_new_record_and_queued_delete_recover():
    repo=FakePostgres()
    repo.put('entries','deleted',{'id':'deleted'},'mine')
    repo.offline=True
    assert repo.get('entries','new') is None
    repo.put('entries','new',{'id':'new','saved':True},'mine')
    repo.delete('entries','deleted')
    assert repo.get('entries','deleted') is None
    repo.offline=False
    assert [x['id'] for x in repo.all('entries','mine')]==['new']
    assert ('entries','deleted') not in repo.database


def test_nonrecoverable_error_and_buffer_limit_do_not_claim_success(monkeypatch):
    repo=FakePostgres()
    def fail(*args):raise IntegrityError('PRIVATE SQL',{},Exception('PRIVATE'))
    monkeypatch.setattr(repo,'_db_put',fail)
    with pytest.raises(StorageUnavailable,match='could not be confirmed'):repo.put('entries','bad',{})
    assert not repo.pending
    repo=FakePostgres();repo.offline=True;repo.pending_limit=1
    repo.put('entries','one',{})
    with pytest.raises(StorageUnavailable,match='buffer full'):repo.put('entries','two',{})
    assert repo.get('entries','one')['persistence_status']=='pending_retry'


def test_api_save_during_outage_and_complete_recovery(monkeypatch):
    monkeypatch.setenv('NUMA_DEMO_NAME_LOGIN','false')
    repo=FakePostgres()
    client=TestClient(create_app(repo=repo,demo=True,secret='a'*40))
    headers=login(client)
    entry=text_entry(client,headers,key='storage-outage')
    repo.offline=True
    response=client.patch('/api/patient/entries/'+entry['id'],headers=headers,
        json={'transcript':'Edited private words','summary':'Editable summary','saved':True})
    assert response.status_code==200
    assert response.json()['saved'] and response.json()['persistence_status']=='pending_retry'
    repo.offline=False
    assert client.get('/api/patient/entries/'+entry['id'],headers=headers).json()['persistence_status']=='persisted'


def forbidden_keys(value):
    forbidden={'transcript','transcription','summary','audio','experiments','experiment','reflection','reflections','question','explicit','probabilities','raw_scores','tags'}
    if isinstance(value,dict):
        assert not forbidden.intersection(value)
        for item in value.values():forbidden_keys(item)
    elif isinstance(value,list):
        for item in value:forbidden_keys(item)


def exercise_restart(repo_factory,monkeypatch,prefix='restart-test'):
    """Used by both mock and opt-in real PostgreSQL; only own verification records."""
    import backend.app as module
    from backend.security import issue_token
    from backend.domain import utcnow,simulated_context
    monkeypatch.setattr(module,'seed',lambda repo:None)
    repo=repo_factory()
    owner=prefix+'-patient';other=prefix+'-other';clinician=prefix+'-clinician'
    user={'id':owner,'name':'Verification patient','role':'patient','source':'live'}
    repo.put('users',owner,user)
    repo.put('users',other,{**user,'id':other})
    repo.put('users',clinician,{'id':clinician,'name':'Verification clinician','role':'psychologist','source':'live','assigned':[owner]})
    key=owner+'-old-entry'
    old={'id':key,'patient_id':owner,'created_at':utcnow(),'status':'completed','saved':True,
         'source':'live','transcript':'PRIVATE LEGACY','summary':'PRIVATE SUMMARY',
         'context':{**simulated_context(),'transcript':'PRIVATE','experiments':{'reflection':'PRIVATE'}}}
    repo.put('entries',key,old,owner)
    secret='restart-test-secret-32-characters-minimum'
    headers=lambda uid:{'Authorization':'Bearer '+issue_token(uid,secret)}
    client=TestClient(create_app(repo=repo,demo=True,secret=secret));patient=headers(owner);clinic=headers(clinician)
    entry=text_entry(client,patient,key=prefix+'-new')
    path='/api/patient/entries/'+entry['id']
    assert client.patch(path,headers=patient,json={'saved':True}).status_code==200
    assert client.post(path+'/action',headers=patient,json={'kind':'walk','completed':True,'feedback':'helpful'}).status_code==200
    assert client.patch('/api/patient/growth',headers=patient,json={'habit_label':'Verification habit','habit_done':True}).status_code==200
    experiment=client.post('/api/patient/experiments',headers=patient,json={'question':'PRIVATE QUESTION','kind':'walk'}).json()
    assert client.patch('/api/patient/experiments/'+experiment['id'],headers=patient,json={'status':'completed','reflection':'PRIVATE REFLECTION'}).status_code==200
    assert client.patch('/api/clinic/patients/'+owner+'/notes',headers=clinic,json={'text':'Verification professional note'}).status_code==200
    repo.close()
    restarted=repo_factory();client=TestClient(create_app(repo=restarted,demo=True,secret=secret))
    assert client.get(path,headers=patient).json()['action']['feedback']=='helpful'
    assert client.get('/api/patient/entries/'+key,headers=patient).json()['transcript']=='PRIVATE LEGACY'
    assert client.get('/api/patient/entries/'+key,headers=headers(other)).status_code==404
    assert client.get('/api/patient/growth',headers=patient).json()['habit_done_today']
    assert client.get('/api/patient/experiments',headers=patient).json()[0]['reflection']=='PRIVATE REFLECTION'
    assert client.get('/api/patient/experiments',headers=clinic).status_code==403
    assert client.get('/api/patient/entries',headers=clinic).status_code==403
    for endpoint in ['/api/clinic/patients','/api/clinic/patients/'+owner]:
        response=client.get(endpoint,headers=clinic);assert response.status_code==200
        forbidden_keys(response.json())
        assert 'PRIVATE' not in response.text
    assert client.get('/api/clinic/patients/'+owner,headers=clinic).json()['notes']['text']=='Verification professional note'
    return restarted,[owner,other,clinician]


def test_mock_restart_all_collections_and_restricted_projection(monkeypatch):
    database={}
    exercise_restart(lambda:FakePostgres(database),monkeypatch)
