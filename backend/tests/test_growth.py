from copy import deepcopy
from fastapi.testclient import TestClient
from backend.app import create_app
from backend.repository import Repository
from backend.domain import utcnow
from backend.growth import growth_projection
from backend.tests.test_numa import client,login,text_entry

def test_new_space_starts_without_metrics(client):
    h=login(client)
    growth=client.get('/api/patient/growth',headers=h).json()
    assert growth['modules']==[]
    assert not growth['simple_mode']
    assert growth['art_stage']=='sprout'
    assert growth['invitations']==[]

def test_simple_view_preserves_modules_across_sessions(client):
    h=login(client)
    selected=['sleep','music','patterns']
    assert client.patch('/api/patient/growth',headers=h,json={'modules':selected}).json()['modules']==selected
    simple=client.patch('/api/patient/growth',headers=h,json={'simple_mode':True}).json()
    assert simple['modules']==selected and simple['simple_mode']
    another=login(client)
    assert client.get('/api/patient/growth',headers=another).json()['modules']==selected
    restored=client.patch('/api/patient/growth',headers=another,json={'simple_mode':False}).json()
    assert restored['modules']==selected and not restored['simple_mode']

def test_invitations_have_evidence_and_dismissal_is_remembered(client,monkeypatch):
    h=login(client,'sample@numa.demo','sample-demo')
    growth=client.get('/api/patient/growth',headers=h).json()
    assert len(growth['invitations'])==1
    invitation=growth['invitations'][0]
    assert invitation['evidence_count']>=3
    dismissed=client.patch('/api/patient/growth',headers=h,json={'dismiss_invitation':invitation['id']}).json()
    assert dismissed['invitations']==[]
    monkeypatch.setattr('backend.growth.utcnow',lambda:'2030-01-01T00:00:00+00:00')
    later=client.get('/api/patient/growth',headers=h).json()
    assert invitation['id'] not in [i['id'] for i in later['invitations']]

def test_growth_never_uses_mood_and_plant_keeps_memory(client):
    h=login(client,'sample@numa.demo','sample-demo')
    before=client.get('/api/patient/growth',headers=h).json()
    assert before['art_stage']=='bloom'
    client.patch('/api/patient/growth',headers=h,json={'modules':['voice','sleep']})
    repo=client.app.state.repo
    for entry in repo.all('entries','patient-sample'):
        repo.delete('entries',entry['id'])
    after=client.get('/api/patient/growth',headers=h).json()
    assert after['art_stage']=='bloom'
    assert after['modules']==['voice','sleep']
    user=repo.get('users','patient-sample')
    assert growth_projection(user,[])['art_stage']==before['art_stage']

def test_intention_is_optional_and_has_no_streak(client):
    h=login(client)
    assert client.patch('/api/patient/growth',headers=h,json={'habit_done':True}).status_code==422
    client.patch('/api/patient/growth',headers=h,json={'modules':['habits'],'habit_label':'A quiet cup of tea'})
    done=client.patch('/api/patient/growth',headers=h,json={'habit_done':True}).json()
    assert done['habit_done_today']
    assert 'streak' not in done
    client.patch('/api/patient/growth',headers=h,json={'modules':[]})
    restored=client.patch('/api/patient/growth',headers=h,json={'modules':['habits']}).json()
    assert restored['habit_label']=='A quiet cup of tea' and restored['habit_done_today']

def test_experiments_are_private_and_can_pause_and_finish(client):
    h=login(client)
    created=client.post('/api/patient/experiments',headers=h,json={'question':'PRIVATE EXPERIMENT: What follows a walk?','kind':'walk'})
    assert created.status_code==200
    item=created.json()
    assert item['responses']==0
    assert client.post('/api/patient/experiments',headers=h,json={'question':'A second question','kind':'walk'}).status_code==409
    path='/api/patient/experiments/'+item['id']
    assert client.patch(path,headers=h,json={'status':'paused'}).json()['status']=='paused'
    assert client.patch(path,headers=h,json={'status':'active'}).json()['status']=='active'
    finished=client.patch(path,headers=h,json={'status':'completed','reflection':'PRIVATE REFLECTION'}).json()
    assert finished['reflection']=='PRIVATE REFLECTION'
    assert client.patch(path,headers=h,json={'status':'active'}).status_code==409
    clinic=login(client,'psychologist@numa.demo','care-demo')
    assert client.get('/api/patient/experiments',headers=clinic).status_code==403
    assert client.get('/api/patient/growth',headers=clinic).status_code==403
    projected=client.get('/api/clinic/patients',headers=clinic)
    assert 'PRIVATE EXPERIMENT' not in projected.text and 'PRIVATE REFLECTION' not in projected.text
    sample=login(client,'sample@numa.demo','sample-demo')
    assert client.get('/api/patient/experiments',headers=sample).json()==[]

def test_growth_validation_and_role_boundaries(client):
    h=login(client)
    assert client.patch('/api/patient/growth',headers=h,json={'modules':['unrecognized']}).status_code==422
    assert client.patch('/api/patient/growth',headers=h,json={'dismiss_invitation':'arbitrary'}).status_code==422
    clinic=login(client,'psychologist@numa.demo','care-demo')
    assert client.patch('/api/patient/growth',headers=clinic,json={'modules':['sleep']}).status_code==403
