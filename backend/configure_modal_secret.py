"""User-run merge into numa-secrets; never print secret values or send test DB URL."""
import argparse
import json
from pathlib import Path
import re
import ssl
from urllib.parse import urlsplit
from dotenv import dotenv_values
from .repository import validate_database_url

REQUIRED={'NUMA_DEMO_MODE','NUMA_DEMO_NAME_LOGIN','NUMA_ML_ENABLED','DATABASE_URL',
          'GEMINI_API_KEY','GEMINI_MODEL','NUMA_ALLOWED_ORIGINS'}
OPTIONAL={'NUMA_SEED_DEMO','NUMA_SESSION_SECRET','NUMA_PATIENT_PASSWORD',
          'NUMA_SAMPLE_PASSWORD','NUMA_CLINICIAN_PASSWORD','NUMA_DATABASE_CA_CERT'}


def build_updates(values,certificate=None):
    updates={key:str(value) for key,value in values.items() if key in REQUIRED|OPTIONAL and value is not None}
    # Optional placeholders in the full production template must not rotate live credentials.
    updates={k:v for k,v in updates.items() if k not in OPTIONAL or not v.startswith('REPLACE_')}
    if not REQUIRED.issubset(updates):raise ValueError('Required connected configuration missing.')
    if any(not v.strip() or 'REPLACE_' in v or '<' in v or '>' in v for v in updates.values()):
        raise ValueError('Replace configuration placeholders locally first.')
    for key in ['NUMA_DEMO_MODE','NUMA_ML_ENABLED']:
        if updates[key]!='false':raise ValueError('Connected mode requires demo and ML flags false.')
    url=validate_database_url(updates['DATABASE_URL'])
    if (url.host or '').upper()=='HOST' or url.username in ('USER','TEST_USER') or url.password=='PASSWORD':
        raise ValueError('Database placeholders are not configured.')
    if not re.fullmatch(r'[a-zA-Z0-9._-]+',updates['GEMINI_MODEL']):raise ValueError('Invalid selected model.')
    for origin in updates['NUMA_ALLOWED_ORIGINS'].split(','):
        parsed=urlsplit(origin.strip())
        if '*' in origin or not parsed.hostname or parsed.username or parsed.password or parsed.path or parsed.query or parsed.fragment:
            raise ValueError('CORS must contain exact origins only.')
        if parsed.scheme!='https' and not (parsed.scheme=='http' and parsed.hostname in {'127.0.0.1','localhost'}):
            raise ValueError('Public origins must use HTTPS.')
    if certificate:updates['NUMA_DATABASE_CA_CERT']=certificate
    if url.query['sslmode'] in ('verify-ca','verify-full'):
        ssl.PEM_cert_to_DER_cert(updates.get('NUMA_DATABASE_CA_CERT',''))
    if 'NUMA_SESSION_SECRET' in updates and len(updates['NUMA_SESSION_SECRET'])<32:raise ValueError('Session secret too short.')
    for key in ['NUMA_PATIENT_PASSWORD','NUMA_SAMPLE_PASSWORD','NUMA_CLINICIAN_PASSWORD']:
        if key in updates and len(updates[key])<16:raise ValueError('Account password too short.')
    return updates


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--env-file',type=Path,required=True)
    parser.add_argument('--ca-file',type=Path)
    parser.add_argument('--check',action='store_true',help='Validate locally without contacting Modal')
    args=parser.parse_args()
    try:
        local=Path(__file__).resolve().parents[1]/'.local'
        if not args.env_file.is_file():
            print(json.dumps({'status':'BLOQUEADA','reason':'private_environment_not_configured'}));return 2
        if not args.env_file.resolve().is_relative_to(local.resolve()):raise ValueError('Use an ignored .local environment file.')
        values=dotenv_values(args.env_file)
        certificate=args.ca_file.read_text('utf-8') if args.ca_file else None
        updates=build_updates(values,certificate)
        if not args.check:
            import modal
            modal.Secret.from_name('numa-secrets').update(updates)
        print(json.dumps({'status':'ready_not_applied' if args.check else 'updated',
            'updated_keys':sorted(updates),'existing_unmentioned_keys_preserved':True,
            'test_database_uploaded':False}));return 0
    except Exception as exc:
        print(json.dumps({'status':'failed','error_type':type(exc).__name__}));return 1


if __name__=='__main__':raise SystemExit(main())
