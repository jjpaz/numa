"""Back up local preview state before restarting the ephemeral API."""
import json
import os
from datetime import datetime,timezone
from pathlib import Path
import httpx
from .app import create_app
from .repository import Repository
from .seed import seed

STATE = Path(__file__).resolve().parents[1] / '.local' / 'preview-restore.json'

def backup():
    records=[]
    with httpx.Client(base_url='http://127.0.0.1:8000',timeout=15) as client:
        for email,password in [('patient@numa.demo',os.getenv('NUMA_PATIENT_PASSWORD','journal-demo')),('sample@numa.demo',os.getenv('NUMA_SAMPLE_PASSWORD','sample-demo'))]:
            response=client.post('/api/auth/login',json={'email':email,'password':password});response.raise_for_status()
            login=response.json();headers={'Authorization':'Bearer '+login['token']}
            records.append({'collection':'users','id':login['user']['id'],'owner':'','payload':login['user']})
            response=client.get('/api/patient/entries',headers=headers);response.raise_for_status()
            for entry in response.json():records.append({'collection':'entries','id':entry['id'],'owner':login['user']['id'],'payload':entry})
            response=client.get('/api/patient/experiments',headers=headers)
            if response.status_code==200:
                for item in response.json():records.append({'collection':'experiments','id':item['id'],'owner':login['user']['id'],'payload':item})
        response=client.post('/api/auth/login',json={'email':'psychologist@numa.demo','password':os.getenv('NUMA_CLINICIAN_PASSWORD','care-demo')});response.raise_for_status()
        response=client.get('/api/clinic/patients',headers={'Authorization':'Bearer '+response.json()['token']});response.raise_for_status()
        for patient in response.json():
            if patient['notes'].get('text'):records.append({'collection':'notes','id':patient['id'],'owner':patient['id'],'payload':patient['notes']})
    STATE.parent.mkdir(exist_ok=True)
    if STATE.exists():raise RuntimeError('A pending preview restore exists. Restore it before making another backup.')
    STATE.write_text(json.dumps(records),encoding='utf-8')
    print(f'Preview state backed up: {len(records)} records. Private content was not printed.')

def create_preview():
    repo=Repository(demo=True)
    seed(repo)
    if STATE.exists():
        for record in json.loads(STATE.read_text(encoding='utf-8')):
            if record['collection'] not in ('users','entries','notes','experiments'):raise RuntimeError('Unsupported preview record.')
            repo.put(record['collection'],record['id'],record['payload'],record['owner'])
        archive=STATE.with_name('preview-backup-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%f')+'.json')
        STATE.rename(archive)
    return create_app(repo=repo,demo=True,secret=os.getenv('NUMA_SESSION_SECRET') or 'numa-local-preview-only-not-for-public-deployment')

if __name__=='__main__':backup()
