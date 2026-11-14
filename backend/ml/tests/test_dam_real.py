"""Explicit opt-in: actual weights, no mocks; technical check, not clinical validation."""
import math
import os
from pathlib import Path
import sys

import pytest

from backend.ml.check import inspect_audio
from backend.ml import dam_adapter as adapter

pytestmark = pytest.mark.skipif(
    os.getenv("NUMA_RUN_DAM_REAL_TEST") != "1",
    reason="Opt in with NUMA_RUN_DAM_REAL_TEST=1 and NUMA_DAM_TEST_AUDIO",
)


def test_real_pinned_dam_inference_is_finite_and_repeatable():
    import torch

    torch.set_num_threads(4)
    audio = Path(os.environ["NUMA_DAM_TEST_AUDIO"])
    inspect_audio(audio)
    cache = Path(os.getenv("NUMA_DAM_TEST_CACHE", str(adapter.PROJECT_ROOT / "model-cache")))
    first = adapter.infer(audio, cache, "cpu")
    second = adapter.infer(audio, cache, "cpu")
    assert set(first) == {"depression", "anxiety"}
    assert all(math.isfinite(value) for value in first.values())
    assert second == pytest.approx(first, rel=0, abs=1e-6)
    assert "backend.app" not in sys.modules and "backend.repository" not in sys.modules
    model = adapter.load_pipeline(cache).model
    assert not model.training
    assert all(not module.training for module in model.modules())
    assert all(not parameter.requires_grad for parameter in model.parameters())
