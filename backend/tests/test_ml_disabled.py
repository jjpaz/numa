"""The connected API must remain usable without ML packages or model loading."""
import ast
import sys
from pathlib import Path

import numpy as np
import pytest

from backend import analysis
from backend.tests.test_numa import wav_bytes


@pytest.mark.parametrize('samples', [np.zeros(64000), .1*np.sin(np.arange(64000)/8)])
def test_connected_voice_defaults_to_not_configured(samples, monkeypatch):
    monkeypatch.delenv('NUMA_ML_ENABLED', raising=False)
    monkeypatch.setattr(analysis, 'load_voice_model', lambda: pytest.fail('ML must not load'))
    before = set(sys.modules)
    result = analysis.analyse_voice(wav_bytes(samples), False)
    assert result['ml_status'] == 'not_configured'
    assert result['model'] is None and result['probabilities'] == {}
    assert not {'torch','silero_vad','speechbrain','backend.ml.dam_adapter','backend.ml.audio_quality'} & (set(sys.modules)-before)


def test_modal_definition_has_no_model_runtime_or_gpu():
    source = Path('backend/modal_app.py').read_text('utf-8')
    tree = ast.parse(source)
    assert not any(isinstance(node, ast.keyword) and node.arg in {'gpu', 'volumes'} for node in ast.walk(tree))
    assert '.pip_install(' not in source
    for name in ['torch','torchaudio','transformers','speechbrain','silero','peft']:
        assert name not in Path('backend/requirements.txt').read_text('utf-8').lower()
