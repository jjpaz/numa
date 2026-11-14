"""Isolated authenticated Modal RPC check, never the public Numa application.

Run from the project root with modal run -m backend.ml.modal_check --audio ...
--report .local/ml-results/<new-name>.json. Only explicitly selected test audio
is sent; raw scores go to that private report, never stdout.
"""
from __future__ import annotations

import contextlib
import hashlib
import io
import json
from pathlib import Path
import sys
import tempfile
import time

import modal

from . import dam_adapter as adapter
from .check import inspect_audio, report_destination, runtime_versions

APP_NAME = 'numa-dam-validation'
VOLUME_NAME = 'numa-dam-validation-weights'
CACHE = Path('/models')
app = modal.App(APP_NAME)
weights = modal.Volume.from_name(VOLUME_NAME, create_if_missing=True)
image = (
    modal.Image.debian_slim(python_version='3.11.18')
    .apt_install('libsndfile1')
    .pip_install('torch==2.7.0+cpu', 'torchaudio==2.7.0+cpu',
                 index_url='https://download.pytorch.org/whl/cpu')
    .pip_install_from_requirements('backend/ml/requirements-cpu-linux.lock.txt')
    .run_commands('python -m pip check')
    .env({'HF_HOME': '/models/hf', 'HF_HUB_DISABLE_PROGRESS_BARS': '1',
          'TOKENIZERS_PARALLELISM': 'false'})
    .add_local_python_source('backend')
    .add_local_file('backend/ml/dam_manifest.json', '/root/backend/ml/dam_manifest.json')
)


def revisions():
    spec = adapter.manifest()
    return {'model': spec['model'], 'model_revision': spec['revision'],
            'backbone_revision': spec['backbone']['revision'],
            'pipeline_version': spec['pipeline_version']}


@app.function(image=image, volumes={'/models': weights}, cpu=1, memory=1024,
              min_containers=0, buffer_containers=0, max_containers=1,
              scaledown_window=30, timeout=600, retries=0)
def prepare():
    """Populate and explicitly commit only pinned model artifacts, never audio."""
    started = time.perf_counter()
    try:
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            dam, backbone = adapter.prepare_artifacts(str(CACHE))
            weights.commit()
        return {'status': 'prepared_not_inferred', **revisions(),
                'prepare_sec': round(time.perf_counter()-started, 3),
                'checkpoint_bytes': (dam/'dam3.1.ckpt').stat().st_size,
                'backbone_bytes': (backbone/'model.safetensors').stat().st_size}
    except Exception as exc:
        return {'status': 'failed', 'phase': 'prepare', 'error_type': type(exc).__name__}


@app.function(image=image, volumes={'/models': weights}, cpu=4, memory=8192,
              env={'HF_HUB_OFFLINE': '1', 'TRANSFORMERS_OFFLINE': '1'},
              block_network=True, min_containers=0, buffer_containers=0,
              max_containers=1, scaledown_window=30, timeout=300, retries=0)
def check(audio_bytes: bytes):
    """Real CPU inference in a separate, network-blocked Linux container."""
    result = {'status': 'failed', **revisions(), 'device': 'cpu',
              'runtime': runtime_versions(), 'offline_inference': True,
              'audio_sha256': hashlib.sha256(audio_bytes).hexdigest()}
    started = time.perf_counter()
    phase = 'input_validation'
    try:
        if not audio_bytes or len(audio_bytes)>10*1024*1024:
            raise ValueError('invalid_audio_size')
        with tempfile.TemporaryDirectory(prefix='numa-dam-') as folder:
            audio = Path(folder)/'fixture.wav'
            audio.write_bytes(audio_bytes)
            result['audio'] = inspect_audio(audio)
            phase = 'load'
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                import resource
                import torch

                torch.set_num_threads(4)
                load_started = time.perf_counter()
                pipeline = adapter.load_pipeline(CACHE, 'cpu')
                result['load_sec'] = round(time.perf_counter()-load_started, 3)
                phase = 'inference'
                durations = []
                scores = []
                for _ in range(2):
                    inference_started = time.perf_counter()
                    scores.append(adapter.infer(audio, CACHE, 'cpu'))
                    durations.append(round(time.perf_counter()-inference_started, 3))
                difference = max(abs(scores[0][key]-scores[1][key]) for key in scores[0])
                if difference>1e-6:
                    raise ValueError('repeatability_failed')
                result.update(raw_scores=scores[0], inference_sec=durations,
                              repeat_max_abs_diff=difference, finite_scores=True,
                              model_reused=adapter.load_pipeline(CACHE, 'cpu') is pipeline,
                              frozen=all(not p.requires_grad for p in pipeline.model.parameters()),
                              eval_mode=all(not m.training for m in pipeline.model.modules()),
                              cuda_available=torch.cuda.is_available(),
                              peak_rss_mib=round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1024, 2))
            if not result['frozen'] or not result['eval_mode'] or not result['model_reused']:
                raise ValueError('model_state_failed')
            forbidden = {'backend.app','backend.repository','backend.analysis','fastapi','sqlalchemy'}
            result['independent_of_api'] = not bool(forbidden.intersection(sys.modules))
            if not result['independent_of_api']:
                raise ValueError('application_imported')
            result['status'] = 'completed'
    except Exception as exc:
        result.pop('raw_scores', None)
        result.update(status='failed', phase=phase, error_type=type(exc).__name__)
    result['total_sec'] = round(time.perf_counter()-started, 3)
    return result


def public_result(result):
    """Redact raw model scores before printing terminal output."""
    return {key: value for key, value in result.items() if key != 'raw_scores'}


@app.local_entrypoint()
def main(audio: str, report: str):
    # Validate path/fixture before any paid remote call. Never overwrite a report.
    try:
        source = Path(audio)
        inspect_audio(source)
        destination = report_destination(Path(report))
        payload = source.read_bytes()
    except Exception as exc:
        print(json.dumps({'status': 'failed', 'phase': 'local_input',
                          'error_type': type(exc).__name__}))
        raise SystemExit(1) from None
    preparation = prepare.remote()
    if preparation['status'] != 'prepared_not_inferred':
        print(json.dumps(preparation))
        raise SystemExit(1)
    result = check.remote(payload)
    result['preparation'] = preparation
    result['modal_app'] = APP_NAME
    result['weights_volume'] = VOLUME_NAME
    result['resource_limits'] = {'cpu': 4, 'memory_mib': 8192, 'gpu': None,
                               'min_containers': 0, 'max_containers': 1,
                               'timeout_sec': 300}
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open('x', encoding='utf-8') as handle:
        json.dump(result, handle, indent=2, allow_nan=False)
    print(json.dumps(public_result(result), indent=2, allow_nan=False))
    if result['status'] != 'completed':
        raise SystemExit(1)
