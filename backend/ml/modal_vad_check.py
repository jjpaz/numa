"""Isolated CPU phase-B validation, never deployed as the public demo."""
from pathlib import Path
import hashlib
import json
import sys

import modal

from .check import report_destination, runtime_versions
from .modal_check import base_image, CACHE, weights
from . import dam_adapter
from .vad_validation import FIXTURE_SHA256, public_summary

app = modal.App('numa-vad-validation')
image = (
    base_image.apt_install('ffmpeg', 'espeak-ng')
    .pip_install_from_requirements('backend/ml/requirements-vad.txt')
    .run_commands('python -m pip check')
    .add_local_python_source('backend')
    .add_local_file('backend/ml/dam_manifest.json', '/root/backend/ml/dam_manifest.json')
    .add_local_file('backend/ml/vad_manifest.json', '/root/backend/ml/vad_manifest.json')
)


@app.function(image=image, volumes={'/models': weights}, cpu=4, memory=8192,
              min_containers=0, buffer_containers=0, max_containers=1,
              scaledown_window=30, timeout=300, retries=0, block_network=True,
              env={'HF_HUB_OFFLINE': '1', 'TRANSFORMERS_OFFLINE': '1'})
def validate(primary: bytes, browser: bytes | None):
    from .vad_validation import run_suite
    import importlib.metadata
    import subprocess

    try:
        result = run_suite(primary, CACHE, browser=browser, run_dam=True)
        result['runtime'] = runtime_versions() | {'silero-vad': importlib.metadata.version('silero-vad')}
        result['ffmpeg'] = subprocess.run(['ffmpeg', '-version'], capture_output=True,
                                           text=True, check=True).stdout.splitlines()[0]
        result['espeak'] = subprocess.run(['espeak-ng', '--version'], capture_output=True,
                                          text=True, check=True).stdout.splitlines()[0]
        result['dam'] = {key: dam_adapter.manifest()[key] for key in ('model', 'revision', 'pipeline_version')}
        result['independent_of_api'] = not bool({'backend.app', 'backend.analysis', 'backend.repository',
                                                'fastapi', 'sqlalchemy'}.intersection(sys.modules))
        if not result['independent_of_api']:
            result['status'] = 'failed'
        return result
    except Exception as exc:
        return {'status': 'failed', 'error_type': type(exc).__name__}


@app.local_entrypoint()
def main(audio: str, report: str, browser_audio: str = ''):
    try:
        destination = report_destination(Path(report))
        primary = Path(audio).read_bytes()
        if hashlib.sha256(primary).hexdigest() != FIXTURE_SHA256:
            raise ValueError('expected_controlled_fixture')
        browser = Path(browser_audio).read_bytes() if browser_audio else None
        if browser is not None and not 0 < len(browser) <= 10 * 1024 * 1024:
            raise ValueError('invalid_browser_fixture_size')
    except Exception as exc:
        print(json.dumps({'status': 'failed', 'phase': 'local_input', 'error_type': type(exc).__name__}))
        raise SystemExit(1) from None
    result = validate.remote(primary, browser)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open('x', encoding='utf-8') as target:
        json.dump(result, target, indent=2, allow_nan=False)
    print(json.dumps(public_summary(result), indent=2, allow_nan=False))
    if result['status'] != 'completed':
        raise SystemExit(1)
