import hmac
import os
import secrets
from datetime import datetime,timezone
from concurrent.futures import ThreadPoolExecutor
from typing import Literal
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from .repository import Repository, StorageUnavailable
from .security import issue_token, verify_session
from .seed import USERS, seed
from .domain import utcnow, simulated_context, patterns, baseline_and_trend, clinical_projection, recommend, ACTIONS
from .analysis import transcribe, semantics, analyse_voice, explain_recommendation, ml_enabled
from .growth import growth_projection, growth_settings, MODULES

load_dotenv()

class Login(BaseModel):
    email: str = Field(max_length=200)
    password: str = Field(max_length=200)

class DemoLogin(BaseModel):
    name: str = Field(min_length=1,max_length=80)
    role: Literal['patient','psychologist']
    sample: bool = False

class EntryPatch(BaseModel):
    transcript: str | None = Field(default=None,max_length=16000)
    summary: str | None = Field(default=None,max_length=1500)
    saved: bool | None = None

class TextEntry(BaseModel):
    text: str = Field(min_length=1,max_length=16000)
    request_id: str = Field(min_length=8,max_length=80,pattern=r'^[a-zA-Z0-9-]+$')

class ActionUpdate(BaseModel):
    kind: Literal['walk','music','breathe','connect']
    completed: bool = False
    feedback: Literal['helpful','not_helpful','skip'] | None = None

class Note(BaseModel):
    text: str = Field(max_length=4000)

class Preferences(BaseModel):
    actions: list[Literal['walk','music','breathe','connect']] = Field(min_length=1,max_length=4)

class GrowthUpdate(BaseModel):
    simple_mode: bool | None = None
    modules: list[Literal['sleep','activity','music','habits','patterns','voice','experiments']] | None = Field(default=None,max_length=7)
    dismiss_invitation: str | None = Field(default=None,max_length=40)
    habit_label: str | None = Field(default=None,max_length=80)
    habit_done: bool | None = None

class ExperimentCreate(BaseModel):
    question: str = Field(min_length=3,max_length=200)
    kind: Literal['walk','music','breathe','connect']

class ExperimentUpdate(BaseModel):
    status: Literal['active','paused','completed']
    reflection: str | None = Field(default=None,max_length=1500)

def create_app(repo=None, demo=None, secret=None):
    demo = os.getenv('NUMA_DEMO_MODE','false').lower() == 'true' if demo is None else demo
    secret = secret or os.getenv('NUMA_SESSION_SECRET','')
    if not demo and (len(secret)<32 or secret=='local-only-change-before-deployment' or secret.startswith('REPLACE_')):
        raise RuntimeError('Set a unique NUMA_SESSION_SECRET of at least 32 characters.')
    secret = secret or secrets.token_hex(32)
    if not demo:
        for name in ['NUMA_PATIENT_PASSWORD','NUMA_SAMPLE_PASSWORD','NUMA_CLINICIAN_PASSWORD','GEMINI_API_KEY','GEMINI_MODEL']:
            if not os.getenv(name) or os.environ[name].startswith('REPLACE_'): raise RuntimeError(f'{name} is required.')
        if any(os.getenv(name) in ('journal-demo','sample-demo','care-demo') for name in ['NUMA_PATIENT_PASSWORD','NUMA_SAMPLE_PASSWORD','NUMA_CLINICIAN_PASSWORD']):
            raise RuntimeError('Set unique account passwords before deploying connected mode.')
    repo = repo or Repository(os.getenv('DATABASE_URL'),demo)
    if demo or os.getenv('NUMA_SEED_DEMO','false').lower()=='true': seed(repo)
    else:
        for user in USERS:
            if not repo.get('users',user['id']): repo.put('users',user['id'],user)
    app = FastAPI(title='Numa API',version='0.1.0')
    app.state.repo = repo
    app.state.demo = demo
    @app.exception_handler(StorageUnavailable)
    async def storage_unavailable(request, exc):
        return JSONResponse(status_code=503,content={'detail':'Storage is temporarily unavailable. Keep your words and retry.','persistence_status':'unavailable'},headers={'Retry-After':'5'})
    # Optional presentation login can be enabled in connected mode without
    # switching storage or Gemini back to the local demo implementation.
    demo_name_login = os.getenv('NUMA_DEMO_NAME_LOGIN','false').lower()=='true'
    app.add_middleware(CORSMiddleware,allow_origins=[o.strip() for o in os.getenv('NUMA_ALLOWED_ORIGINS','http://127.0.0.1:5173,http://localhost:5173').split(',')],allow_methods=['GET','POST','PATCH','DELETE'],allow_headers=['Authorization','Content-Type'])
    bearer = HTTPBearer(auto_error=False)

    def current(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
        if not credentials: raise HTTPException(401,'Please sign in.')
        session = verify_session(credentials.credentials,secret)
        user = repo.get('users',session['sub'])
        if not user: raise HTTPException(401,'Unknown session.')
        if session.get('display_name'): user={**user,'name':session['display_name']}
        return user

    def patient(user=Depends(current)):
        if user['role']!='patient': raise HTTPException(403,'Private journal access is restricted to its owner.')
        return user

    def clinician(user=Depends(current)):
        if user['role']!='psychologist': raise HTTPException(403,'Psychologist access required.')
        return user

    def own_entry(entry_id,user):
        entry = repo.get('entries',entry_id)
        if not entry or entry['patient_id']!=user['id']: raise HTTPException(404,'Entry not found.')
        return recover_stale(entry)

    def recover_stale(entry):
        changed=False
        for branch in ('analysis','follow_up'):
            job=entry.get(branch,{})
            if job.get('status') in ('pending','processing') and not active_job(entry,branch):
                entry[branch]={'status':'failed','errors':['Analysis was interrupted. You can edit and save your words, or record again.'],'updated_at':utcnow()}
                if branch=='analysis':entry['status']='failed'
                changed=True
        if changed:repo.put('entries',entry['id'],entry,entry['patient_id'])
        return entry

    def writable(user):
        if user['source']=='simulated':
            raise HTTPException(403,'Fictional profiles are read only. Use the fresh patient account to record.')

    def active_job(entry,branch='analysis'):
        job=entry.get(branch,{})
        if job.get('status') not in ('pending','processing'):return False
        stamp=job.get('updated_at') or entry['created_at']
        return (datetime.now(timezone.utc)-datetime.fromisoformat(stamp)).total_seconds()<300

    def assigned(patient_id,user):
        if patient_id not in user.get('assigned',[]): raise HTTPException(404,'Patient not found.')
        return repo.get('users',patient_id)

    def process(entry_id,data=None,mime=None,text=None,follow=False):
        entry = repo.get('entries',entry_id)
        if not entry: return
        branch = 'follow_up' if follow else 'analysis'
        started_at=utcnow()
        with repo.lock:
            entry[branch] = {'status':'processing','errors':[],'updated_at':started_at}
            if not follow: entry['status']='processing'
            repo.put('entries',entry_id,entry,entry['patient_id'])
        errors=[]
        voice=None
        semantic=None
        transcript=None
        def words():
            content = text if text is not None else transcribe(data,mime)
            try:return content,semantics(content,demo)
            except Exception:
                errors.append('Journal summary unavailable. Your words are retained and the summary is editable.')
                return content,None
        with ThreadPoolExecutor(max_workers=2) as pool:
            vf = pool.submit(analyse_voice,data,demo) if data else None
            sf = pool.submit(words) if not follow else None
            if vf:
                try: voice=vf.result()
                except Exception: errors.append('Voice analysis unavailable. Your entry can still be saved.')
            if sf:
                try: transcript,semantic=sf.result()
                except Exception: errors.append('Transcription or journal understanding unavailable. You can type or edit your entry.')
        with repo.lock:
            entry = repo.get('entries',entry_id)
            if not entry: return
            if entry.get(branch,{}).get('updated_at')!=started_at:return
            state = 'failed' if (follow and not voice) or (not follow and voice is None and semantic is None) else 'completed'
            entry[branch] = {'status':state,'errors':errors,'updated_at':utcnow()}
            if follow:
                entry['follow_up'].update(voice=voice,created_at=utcnow(),interpretation='A vocal difference does not establish that an activity helped.')
            else:
                entry['status']=state
                if voice is not None: entry['voice']=voice
                if transcript is not None: entry['transcript']=transcript
                if semantic: entry.update(semantic)
                elif transcript is not None:
                    entry.update(summary=entry.get('summary') or transcript[:1500],tags=[],explicit=[],semantic_source='unavailable')
            repo.put('entries',entry_id,entry,entry['patient_id'])

    def new_entry(user,key):
        writable(user)
        return {'id':key,'patient_id':user['id'],'created_at':utcnow(),'saved':False,'source':'live','status':'pending','transcript':'','summary':'','title':'A journal moment','tags':[],'explicit':[],'context':simulated_context(),'voice':None,'analysis':{'status':'pending','errors':[],'updated_at':utcnow()}}

    @app.get('/api/health')
    def health():
        return {'ok':True,'mode':'local_preview' if demo else 'connected','storage':'postgresql' if repo.engine else 'ephemeral_memory','gemini_configured':bool(os.getenv('GEMINI_API_KEY')),'voice_model_enabled':not demo and ml_enabled(),'ml_enabled':not demo and ml_enabled(),'ml_status':'not_configured' if demo or not ml_enabled() else 'configured_not_verified','audio_retention':'temporary processing only','demo_name_login':demo_name_login}

    @app.post('/api/auth/demo')
    def demo_login(body:DemoLogin):
        if not demo_name_login: raise HTTPException(404,'Demo access is not enabled.')
        name=body.name.strip()
        if not name or (body.sample and body.role!='patient'):
            raise HTTPException(422,'Enter a name and choose a valid demo profile.')
        key='psychologist' if body.role=='psychologist' else 'patient-sample' if body.sample else 'patient-live'
        user={**repo.get('users',key),'name':name}
        return {'token':issue_token(key,secret,display_name=name),'user':user}

    @app.post('/api/auth/login')
    def login(body:Login):
        # Only the three published demonstration identities can authenticate.
        user=next((u for u in USERS if u['email']==body.email.lower() and u['id'] in ('patient-live','patient-sample','psychologist')),None)
        env,default = ('NUMA_CLINICIAN_PASSWORD','care-demo') if user and user['role']=='psychologist' else ('NUMA_SAMPLE_PASSWORD','sample-demo') if user and user['id']=='patient-sample' else ('NUMA_PATIENT_PASSWORD','journal-demo')
        if not user or not hmac.compare_digest(body.password.encode(),os.getenv(env,default).encode()):
            raise HTTPException(401,'Email or password is incorrect.')
        return {'token':issue_token(user['id'],secret),'user':repo.get('users',user['id'])}

    @app.get('/api/auth/me')
    def me(user=Depends(current)): return user

    @app.patch('/api/patient/preferences')
    def preferences(body:Preferences,user=Depends(patient)):
        writable(user)
        stored=repo.get('users',user['id'])
        stored['preferences']=list(dict.fromkeys(body.actions)); return repo.put('users',user['id'],stored)

    @app.get('/api/patient/growth')
    def growth(user=Depends(patient)):
        with repo.lock:
            user=repo.get('users',user['id'])
            entries=repo.all('entries',user['id'])
            projection=growth_projection(user,entries)
            # Illustration remembers pages, never wellbeing; avoid overwriting a concurrent choice.
            if projection['remembered_pages']>growth_settings(user)['remembered_pages']:
                user['growth']={**growth_settings(user),'remembered_pages':projection['remembered_pages']}
                repo.put('users',user['id'],user)
        return projection

    @app.patch('/api/patient/growth')
    def update_growth(body:GrowthUpdate,user=Depends(patient)):
        # Sample journal content stays read-only; presentation choices can be explored.
        with repo.lock:
            user=repo.get('users',user['id'])
            settings=growth_settings(user)
            if body.modules is not None:settings['modules']=list(dict.fromkeys(body.modules))
            if body.simple_mode is not None:settings['simple_mode']=body.simple_mode
            if body.dismiss_invitation is not None:
                allowed={'voice-reference'}|{'pattern-'+kind for kind in ACTIONS}
                if body.dismiss_invitation not in allowed:raise HTTPException(422,'Unknown invitation.')
                if body.dismiss_invitation not in settings['dismissed_invitations']:settings['dismissed_invitations'].append(body.dismiss_invitation)
                settings['snoozed_on']=utcnow()[:10]
            if body.habit_label is not None:settings['habit_label']=body.habit_label.strip()
            if body.habit_done is not None:
                if not settings['habit_label']:raise HTTPException(422,'Choose a habit first.')
                days=set(settings['habit_days'])
                days.add(utcnow()[:10]) if body.habit_done else days.discard(utcnow()[:10])
                settings['habit_days']=sorted(days)
            user['growth']=settings
            repo.put('users',user['id'],user)
        return growth_projection(user,repo.all('entries',user['id']))

    def experiment_view(experiment,user):
        entries=[e for e in repo.all('entries',user['id']) if e.get('saved') and e['created_at']>=experiment['created_at'] and (not experiment.get('completed_at') or e['created_at']<=experiment['completed_at']) and e.get('action',{}).get('kind')==experiment['kind']]
        feedback=[e['action']['feedback'] for e in entries if e['action'].get('feedback') in ('helpful','not_helpful')]
        return {**experiment,'responses':len(feedback),'helpful':feedback.count('helpful')}

    @app.get('/api/patient/experiments')
    def experiments(user=Depends(patient)):
        return [experiment_view(e,user) for e in sorted(repo.all('experiments',user['id']),key=lambda e:e['created_at'],reverse=True)]

    @app.post('/api/patient/experiments')
    def create_experiment(body:ExperimentCreate,user=Depends(patient)):
        writable(user)
        with repo.lock:
            if any(e['status']=='active' for e in repo.all('experiments',user['id'])):raise HTTPException(409,'There is already an active experiment. Pause or finish it first.')
            experiment={'id':secrets.token_hex(12),'patient_id':user['id'],'question':body.question.strip(),'kind':body.kind,'status':'active','created_at':utcnow(),'reflection':''}
            if len(experiment['question'])<3:raise HTTPException(422,'Add a question you want to explore.')
            repo.put('experiments',experiment['id'],experiment,user['id'])
        return experiment_view(experiment,user)

    @app.patch('/api/patient/experiments/{experiment_id}')
    def update_experiment(experiment_id:str,body:ExperimentUpdate,user=Depends(patient)):
        writable(user)
        with repo.lock:
            experiment=repo.get('experiments',experiment_id)
            if not experiment or experiment['patient_id']!=user['id']:raise HTTPException(404,'Experiment not found.')
            if experiment['status']=='completed' and body.status!='completed':raise HTTPException(409,'This experiment is complete. You can start a new question.')
            if body.status=='active' and any(e['id']!=experiment_id and e['status']=='active' for e in repo.all('experiments',user['id'])):raise HTTPException(409,'Pause your other experiment first.')
            experiment['status']=body.status
            if body.status=='completed':experiment['completed_at']=experiment.get('completed_at') or utcnow()
            if body.reflection is not None:experiment['reflection']=body.reflection
            repo.put('experiments',experiment_id,experiment,user['id'])
        return experiment_view(experiment,user)

    @app.get('/api/patient/entries')
    def entries(user=Depends(patient)):
        return sorted([recover_stale(e) for e in repo.all('entries',user['id'])],key=lambda e:e['created_at'],reverse=True)

    @app.get('/api/patient/entries/{entry_id}')
    def entry(entry_id:str,user=Depends(patient)): return own_entry(entry_id,user)

    @app.post('/api/patient/entries/text')
    def text_entry(body:TextEntry,tasks:BackgroundTasks,user=Depends(patient)):
        key=f"{user['id']}-{body.request_id}"
        with repo.lock:
            entry=repo.get('entries',key)
            if entry and (entry['status']=='completed' or active_job(entry)): return entry
            if entry:
                entry['status']='pending';entry['analysis']={'status':'pending','errors':[],'updated_at':utcnow()}
                repo.put('entries',key,entry,user['id'])
                tasks.add_task(process,key,text=body.text)
                return entry
            entry=new_entry(user,key); entry['transcript']=body.text; entry['summary']=body.text[:1500]
            repo.put('entries',key,entry,user['id'])
        tasks.add_task(process,key,text=body.text)
        return entry

    @app.post('/api/patient/entries/audio')
    async def audio_entry(tasks:BackgroundTasks,audio:UploadFile=File(...),request_id:str=Form(...),user=Depends(patient)):
        if len(request_id)<8 or len(request_id)>80 or not all(c.isalnum() or c=='-' for c in request_id): raise HTTPException(422,'Invalid request id.')
        data=await audio.read(10*1024*1024+1)
        if len(data)>10*1024*1024: raise HTTPException(413,'Maximum recording size is 10 MB.')
        if not data: raise HTTPException(422,'Recording is empty.')
        key=f"{user['id']}-{request_id}"
        with repo.lock:
            entry=repo.get('entries',key)
            if entry and (entry['status']=='completed' or active_job(entry)): return entry
            entry=entry or new_entry(user,key)
            entry['status']='pending'; entry['analysis']={'status':'pending','errors':[],'updated_at':utcnow()}
            repo.put('entries',key,entry,user['id'])
        tasks.add_task(process,key,data,audio.content_type or 'audio/webm')
        return entry

    @app.patch('/api/patient/entries/{entry_id}')
    def update_entry(entry_id:str,body:EntryPatch,user=Depends(patient)):
        writable(user)
        entry=own_entry(entry_id,user)
        if entry['status'] in ('pending','processing'): raise HTTPException(409,'Please wait for analysis before editing.')
        if body.transcript is not None and body.transcript!=entry['transcript']:
            # Semantic re-analysis has no access to acoustic output or model probabilities.
            try: entry.update(semantics(body.transcript,demo))
            except Exception:
                entry.update(tags=[],explicit=[],semantic_source='unavailable')
                entry['analysis']={'status':'failed','errors':['Journal understanding is unavailable. Your edited words were saved without inferred feelings.']}
            entry['transcript']=body.transcript
        if body.summary is not None: entry['summary']=body.summary
        if body.saved is not None: entry['saved']=body.saved
        return repo.put('entries',entry_id,entry,user['id'])

    @app.delete('/api/patient/entries/{entry_id}',status_code=204)
    def delete_entry(entry_id:str,user=Depends(patient)):
        writable(user)
        own_entry(entry_id,user); repo.delete('entries',entry_id)

    @app.post('/api/patient/entries/{entry_id}/action')
    def action(entry_id:str,body:ActionUpdate,user=Depends(patient)):
        writable(user)
        entry=own_entry(entry_id,user)
        if not entry['saved']: raise HTTPException(409,'Save the entry first.')
        action=entry.get('action',{})
        if action.get('kind')!=body.kind: action={'kind':body.kind}
        if body.completed: action['completed_at']=action.get('completed_at') or utcnow()
        if body.feedback is not None:
            if not action.get('completed_at'): raise HTTPException(409,'Complete an action before recording feedback.')
            action['feedback']=body.feedback
        entry['action']=action
        return repo.put('entries',entry_id,entry,user['id'])

    @app.post('/api/patient/entries/{entry_id}/follow-up')
    async def follow_up(entry_id:str,tasks:BackgroundTasks,audio:UploadFile=File(...),user=Depends(patient)):
        writable(user)
        entry=own_entry(entry_id,user)
        if not entry.get('action',{}).get('completed_at'): raise HTTPException(409,'Complete an activity before adding a comparison.')
        if active_job(entry,'follow_up'): return entry
        data=await audio.read(10*1024*1024+1)
        if len(data)>10*1024*1024: raise HTTPException(413,'Maximum recording size is 10 MB.')
        if not data: raise HTTPException(422,'Recording is empty.')
        entry['follow_up']={'status':'pending','updated_at':utcnow()}; repo.put('entries',entry_id,entry,user['id'])
        tasks.add_task(process,entry_id,data,audio.content_type or 'audio/webm',follow=True)
        return entry

    @app.get('/api/patient/insights')
    def insights(user=Depends(patient)):
        entries=repo.all('entries',user['id'])
        return {'trend':baseline_and_trend(entries),'patterns':patterns(entries),'context':simulated_context(),'preferences':user.get('preferences',list(ACTIONS))}

    @app.get('/api/patient/recommendation')
    def recommendation(user=Depends(patient)):
        result=recommend(repo.all('entries',user['id']),user.get('preferences',list(ACTIONS)),simulated_context())
        result['explanation']=result['reason']
        return result

    @app.get('/api/clinic/patients')
    def patients(user=Depends(clinician)):
        return [clinical_projection(repo.get('users',uid),repo.all('entries',uid),repo.get('notes',uid) or {'text':''}) for uid in user['assigned']]

    @app.get('/api/clinic/patients/{patient_id}')
    def patient_detail(patient_id:str,user=Depends(clinician)):
        target=assigned(patient_id,user)
        return clinical_projection(target,repo.all('entries',patient_id),repo.get('notes',patient_id) or {'text':''})

    @app.patch('/api/clinic/patients/{patient_id}/notes')
    def notes(patient_id:str,body:Note,user=Depends(clinician)):
        assigned(patient_id,user)
        return repo.put('notes',patient_id,{'text':body.text,'updated_at':utcnow(),'author_id':user['id']},patient_id)

    return app

# Factory invocation prevents import-time credential assumptions in tests and tooling.
