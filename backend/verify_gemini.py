"""List accessible models and explicitly verify a selected audio/JSON model.

No provider output, input path, key or private transcript is printed or stored.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
from dotenv import load_dotenv
from .analysis import list_gemini_models,transcribe,semantics


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--env-file',type=Path,required=True)
    parser.add_argument('--list-models',action='store_true')
    parser.add_argument('--audio',type=Path)
    parser.add_argument('--report',type=Path)
    args=parser.parse_args()
    result={'status':'BLOQUEADA','audio_json_verified':False}
    try:
        if not args.env_file.is_file():
            print(json.dumps(result | {'reason':'private_environment_not_configured'}));return 2
        load_dotenv(args.env_file,override=True)
        if not os.getenv('GEMINI_API_KEY','').strip() or os.environ['GEMINI_API_KEY'].startswith('REPLACE_'):
            print(json.dumps(result));return 2
        models=list_gemini_models()
        if args.list_models:
            print(json.dumps({'status':'listed_not_audio_verified','models':models}));return 0
        model=os.getenv('GEMINI_MODEL','').removeprefix('models/')
        if model not in models:raise ValueError('Selected model is not listed')
        if not args.audio or not args.report:raise ValueError('Audio and new report required')
        root=Path(__file__).resolve().parents[1]/'.local'
        report=args.report.resolve()
        if not report.is_relative_to(root.resolve()) or report.exists():raise ValueError('New ignored report required')
        if args.audio.stat().st_size>10*1024*1024:raise ValueError('Audio too large')
        data=args.audio.read_bytes()
        transcript=transcribe(data,'audio/mp4')
        assert transcript.strip()
        summary=semantics(transcript)
        assert isinstance(summary['summary'],str)
        result={'status':'verified','model':model,'audio_json_verified':True,
            'audio_sha256':hashlib.sha256(data).hexdigest(),'transcript_nonempty':bool(transcript.strip()),
            'text_summary_verified':True,'literal_evidence_verified':all(x['evidence'] in transcript for x in summary['explicit'])}
        report.parent.mkdir(parents=True,exist_ok=True)
        with report.open('x',encoding='utf-8') as handle:json.dump(result,handle,indent=2)
        print(json.dumps(result));return 0
    except Exception as exc:
        print(json.dumps({'status':'failed','error_type':type(exc).__name__}));return 1


if __name__=='__main__':raise SystemExit(main())
