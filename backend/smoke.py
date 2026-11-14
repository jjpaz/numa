"""Account-dependent checks. No credentials or model inputs are printed."""
import argparse
import io
import os
import secrets
import wave
import numpy as np
from dotenv import load_dotenv
from .repository import Repository
from .analysis import gemini,analyse_voice

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--voice',action='store_true');args=parser.parse_args()
    load_dotenv()
    if not os.getenv('DATABASE_URL') or not os.getenv('GEMINI_API_KEY'):
        raise SystemExit('NOT RUN: configure DATABASE_URL and GEMINI_API_KEY first. No live integrations have been verified.')
    checks=[]
    try:
        repo=Repository(os.environ['DATABASE_URL']);key='smoke-'+secrets.token_hex(8)
        try:
            repo.put('verification',key,{'connected':True},'smoke')
            assert repo.get('verification',key)=={'connected':True}
        finally:repo.delete('verification',key)
        checks.append('PostgreSQL write/read/delete: PASS')
    except Exception as exc:
        checks.append('PostgreSQL: FAIL ('+type(exc).__name__+')')
    try:
        result=gemini('Return JSON {"ok":true}.')
        assert result.get('ok') is True
        checks.append('Gemini JSON response: PASS')
    except Exception as exc:checks.append('Gemini: FAIL ('+type(exc).__name__+')')
    if args.voice:
        try:
            from huggingface_hub import hf_hub_download
            # Public reference audio shipped by the model authors, not a person's private recording.
            path=hf_hub_download('speechbrain/emotion-recognition-wav2vec2-IEMOCAP','neutral.wav',revision=os.getenv('NUMA_MODEL_REVISION','main'))
            with open(path,'rb') as handle:result=analyse_voice(handle.read(),False)
            assert result['ml_status']=='completed' and abs(sum(result['probabilities'].values())-1)<.01
            checks.append('SpeechBrain real inference: PASS')
        except Exception as exc:checks.append('SpeechBrain: FAIL ('+type(exc).__name__+')')
    print('\n'.join(checks))
    raise SystemExit(1 if any('FAIL' in c for c in checks) else 0)

if __name__=='__main__':main()
