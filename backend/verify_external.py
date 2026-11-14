"""External HTTP verification before/after redeploy. No TestClient or private output."""
import argparse
import hashlib
import json
from pathlib import Path
import secrets
import time
from urllib.parse import urlsplit
from dotenv import dotenv_values
import httpx


def assert_projection(value):
    forbidden={'transcript','transcription','summary','audio','experiments','experiment','question',
               'reflection','reflections','explicit','raw_scores','probabilities','tags'}
    if isinstance(value,dict):
        if forbidden.intersection(value):raise ValueError('Private field in clinical projection')
        for item in value.values():assert_projection(item)
    elif isinstance(value,list):
        for item in value:assert_projection(item)


def sign_in(client,values,role):
    email,password=('patient@numa.demo',values['NUMA_PATIENT_PASSWORD']) if role=='patient' else ('psychologist@numa.demo',values['NUMA_CLINICIAN_PASSWORD'])
    response=client.post('/api/auth/login',json={'email':email,'password':password})
    response.raise_for_status()
    return {'Authorization':'Bearer '+response.json()['token']}


def run(client,values,phase,state_path,audio=None):
    health=client.get('/api/health');health.raise_for_status();health=health.json()
    if health.get('mode')!='connected' or health.get('storage')!='postgresql' or not health.get('gemini_configured'):
        return {'status':'BLOQUEADA','reason':'connected_deployment_not_configured'}
    if health.get('voice_model_enabled') or health.get('ml_status')!='not_configured':raise ValueError('ML must be disabled')
    headers=sign_in(client,values,'patient')
    if phase=='create':
        if state_path.exists():raise ValueError('State file already exists')
        if not audio or not audio.is_file():return {'status':'BLOQUEADA','reason':'real_safari_audio_file_required'}
        if audio.stat().st_size>10*1024*1024:raise ValueError('Audio too large')
        payload=audio.read_bytes();key='verify-'+secrets.token_hex(12)
        created=client.post('/api/patient/entries/audio',headers=headers,data={'request_id':key},
            files={'audio':('verification-audio.m4a',payload,'audio/mp4')})
        created.raise_for_status();entry_id=created.json()['id']
        path='/api/patient/entries/'+entry_id
        keep=False
        try:
            deadline=time.monotonic()+180
            while time.monotonic()<deadline:
                response=client.get(path,headers=headers);response.raise_for_status();entry=response.json()
                if entry['status'] not in {'pending','processing'}:break
                time.sleep(2)
            else:raise TimeoutError('Analysis polling timeout')
            if not entry.get('transcript','').strip() or entry.get('semantic_source')!='gemini':
                raise ValueError('Real Gemini transcription/summary not verified')
            if entry['voice']['ml_status']!='not_configured':raise ValueError('ML must remain disabled')
            saved=client.patch(path,headers=headers,json={'saved':True});saved.raise_for_status();entry=saved.json()
            if entry.get('persistence_status')!='persisted':raise ValueError('Database did not confirm persistence')
            state={'version':1,'entry_id':entry_id,'transcript_sha256':hashlib.sha256(entry['transcript'].encode()).hexdigest(),
                'audio_sha256':hashlib.sha256(payload).hexdigest(),'phase':'created_before_redeploy'}
            state_path.parent.mkdir(parents=True,exist_ok=True)
            with state_path.open('x',encoding='utf-8') as handle:json.dump(state,handle,indent=2)
            keep=True
            return {'status':'created_and_read_back','postgresql_confirmed':True,'gemini_transcription_and_summary':True,
                    'redeploy_persistence':'not_verified_yet','audio_stored_by_verifier':False}
        finally:
            if not keep:client.delete(path,headers=headers)
    state=json.loads(state_path.read_text('utf-8'))
    if state.get('version')!=1 or state.get('phase')!='created_before_redeploy':raise ValueError('Unexpected verification state')
    path='/api/patient/entries/'+state['entry_id']
    response=client.get(path,headers=headers);response.raise_for_status();entry=response.json()
    if not entry['saved'] or hashlib.sha256(entry['transcript'].encode()).hexdigest()!=state['transcript_sha256']:
        raise ValueError('Persisted transcript mismatch')
    if entry.get('persistence_status')!='persisted':raise ValueError('Persistence not confirmed')
    clinic=sign_in(client,values,'clinic')
    for endpoint in ['/api/patient/entries',path,'/api/patient/experiments']:
        if client.get(endpoint,headers=clinic).status_code!=403:raise ValueError('Role isolation failed')
    for endpoint in ['/api/clinic/patients','/api/clinic/patients/patient-live']:
        response=client.get(endpoint,headers=clinic);response.raise_for_status();assert_projection(response.json())
    client.delete(path,headers=headers).raise_for_status()
    state['phase']='read_after_redeploy_and_cleaned'
    state_path.write_text(json.dumps(state,indent=2),encoding='utf-8')
    return {'status':'verified_and_own_entry_deleted','read_after_redeploy':True,'role_privacy':True}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base',required=True)
    parser.add_argument('--credentials',type=Path,required=True)
    parser.add_argument('--state',type=Path,required=True)
    parser.add_argument('--phase',choices=['create','read-after-redeploy'],required=True)
    parser.add_argument('--audio',type=Path)
    args=parser.parse_args()
    try:
        local=Path(__file__).resolve().parents[1]/'.local'
        url=urlsplit(args.base)
        if url.path not in ('','/') or url.query or url.fragment or url.username or url.password:raise ValueError('Use a backend origin')
        if url.scheme!='https' and not(url.scheme=='http' and url.hostname in {'localhost','127.0.0.1'}):raise ValueError('HTTPS required')
        if not args.state.resolve().is_relative_to(local.resolve()):raise ValueError('Use ignored local state')
        if not args.credentials.is_file():
            print(json.dumps({'status':'BLOQUEADA','reason':'credentials_file_not_configured'}));return 2
        values=dotenv_values(args.credentials)
        with httpx.Client(base_url=args.base.rstrip('/'),timeout=30) as client:
            result=run(client,values,args.phase,args.state,args.audio)
        print(json.dumps(result));return 2 if result['status']=='BLOQUEADA' else 0
    except Exception as exc:
        print(json.dumps({'status':'failed','error_type':type(exc).__name__}));return 1


if __name__=='__main__':raise SystemExit(main())
