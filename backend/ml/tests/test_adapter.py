"""Contract tests use fixtures/mocks, never claim to validate model accuracy."""
from array import array
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
import hashlib
import json
import math
from pathlib import Path
import subprocess
import sys
import types
import wave

import pytest

from backend.ml import check
from backend.ml import dam_adapter as adapter


def make_wav(path, seconds=30, kind="voice_like"):
    # A sine is useful for file validation only, not as a model evaluation sample.
    if kind == "silent":
        values = array("h", [0]) * (16000 * seconds)
    elif kind == "clipped":
        values = array("h", [32767, -32767]) * (8000 * seconds)
    else:
        values = array("h", (int(4000 * math.sin(i / 8)) for i in range(16000))) * seconds
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(1)
        handle.setframerate(16000)
        handle.setsampwidth(2)
        handle.writeframes(values.tobytes())
    return path


def test_cli_import_is_independent_of_api_and_ml():
    code = ("import sys; import backend.ml.check; "
            "assert not {'torch','fastapi','sqlalchemy','backend.app',"
            "'backend.analysis','backend.repository'}.intersection(sys.modules)")
    subprocess.run([sys.executable, "-c", code], check=True, capture_output=True)


@pytest.mark.parametrize("scores", [
    {"depression": float("nan"), "anxiety": .1},
    {"depression": .2, "anxiety": float("inf")},
    {"depression": .2}, {"depression": .2, "anxiety": .1, "extra": 5},
])
def test_rejects_non_finite_or_unexpected_scores(scores):
    with pytest.raises(ValueError):
        adapter.validate_scores(scores)


def test_scores_remain_raw_floats():
    assert adapter.validate_scores({"depression": -2.5, "anxiety": 4.2}) == {
        "depression": -2.5, "anxiety": 4.2,
    }


def test_corrupted_cached_source_is_rejected(tmp_path):
    path = tmp_path / "pipeline.py"
    path.write_bytes(b"original")
    digest = hashlib.sha256(b"original").hexdigest()
    adapter.verify_files(tmp_path, {path.name: digest})
    path.write_bytes(b"tampered")
    with pytest.raises(ValueError, match="integrity"):
        adapter.verify_files(tmp_path, {path.name: digest})


def test_namespaced_reference_does_not_use_or_replace_generic_modules(tmp_path, monkeypatch):
    (tmp_path / "config.py").write_text("VALUE = 7\n")
    (tmp_path / "model.py").write_text("from config import VALUE\nVALUE += 1\n")
    (tmp_path / "featex.py").write_text(
        'from config import VALUE\nEXTRACTOR = "openai/whisper-small.en"\n')
    (tmp_path / "pipeline.py").write_text(
        'from config import VALUE\nfrom model import VALUE as MODEL_VALUE\n'
        'from featex import EXTRACTOR\nimport torch\n'
        'def checkpoint(): return torch.load("fixture")\n')
    generic = types.ModuleType("config")
    generic.VALUE = -1
    monkeypatch.setitem(sys.modules, "config", generic)
    monkeypatch.setitem(sys.modules, "torch", types.SimpleNamespace(load=lambda *a, **kw: kw))
    before = set(sys.modules)
    try:
        loaded = adapter.load_reference(tmp_path, tmp_path / "pinned-whisper")
        assert loaded.VALUE == 7 and loaded.MODEL_VALUE == 8
        assert loaded.EXTRACTOR == str(tmp_path / "pinned-whisper")
        assert loaded.checkpoint()["weights_only"] is True
        assert sys.modules["config"] is generic
        assert generic.VALUE == -1
    finally:
        for name in set(sys.modules) - before:
            if name.startswith("_numa_dam_"):
                sys.modules.pop(name)


def test_changed_reference_loader_is_not_silently_patched(tmp_path):
    with pytest.raises(ValueError, match="loader"):
        adapter.reference_tree("pass", "pipeline.py", tmp_path)


def test_concurrent_callers_share_one_pipeline(tmp_path, monkeypatch):
    calls = []
    instance = object()

    @lru_cache(maxsize=1)
    def construct(cache, device):
        calls.append((cache, device))
        return instance

    monkeypatch.setattr(adapter, "_construct_pipeline", construct)
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda _: adapter.load_pipeline(tmp_path), range(16)))
    assert all(result is instance for result in results)
    assert len(calls) == 1


@pytest.mark.parametrize("seconds,kind", [(29, "voice_like"), (121, "voice_like"),
                                        (30, "silent"), (30, "clipped")])
def test_invalid_audio_is_rejected_before_loading_model(tmp_path, monkeypatch, capsys, seconds, kind):
    audio = make_wav(tmp_path / "private-name.wav", seconds, kind)
    monkeypatch.setattr(adapter, "load_pipeline", lambda *a: pytest.fail("Model must not load"))
    assert check.main(["--audio", str(audio)]) == 1
    public = json.loads(capsys.readouterr().out)
    assert public["status"] == "failed" and "raw_scores" not in public
    assert "private-name" not in json.dumps(public)


def test_duration_is_not_claimed_as_effective_speech(tmp_path):
    result = check.inspect_audio(make_wav(tmp_path / "fixture.wav"))
    assert result["duration_sec"] == 30
    assert result["speech_duration_sec"] is None
    assert result["vad_verified"] is False


def test_scores_only_go_to_explicit_ignored_report(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(adapter, "PROJECT_ROOT", tmp_path)
    monkeypatch.setitem(sys.modules, "torch", types.SimpleNamespace(set_num_threads=lambda n: None))
    monkeypatch.setattr(adapter, "load_pipeline", lambda *args: object())
    monkeypatch.setattr(adapter, "infer", lambda *args: {"depression": -2.5, "anxiety": 4.2})
    audio = make_wav(tmp_path / "private-name.wav")
    report = tmp_path / ".local" / "result.json"
    assert check.main(["--audio", str(audio), "--report", str(report)]) == 0
    public = json.loads(capsys.readouterr().out)
    assert public["status"] == "completed" and public["report_saved"]
    assert "raw_scores" not in public and "private-name" not in json.dumps(public)
    assert json.loads(report.read_text())["raw_scores"]["depression"] == -2.5
    assert check.main(["--audio", str(audio), "--report", str(report)]) == 1
    assert json.loads(report.read_text())["raw_scores"]["depression"] == -2.5


def test_report_in_repository_source_is_rejected(tmp_path, monkeypatch):
    monkeypatch.setattr(adapter, "PROJECT_ROOT", tmp_path)
    with pytest.raises(ValueError):
        check.report_destination(tmp_path / "result.json")


def test_failure_does_not_print_exception_private_data(tmp_path, monkeypatch, capsys):
    def fail(*args):
        raise RuntimeError("private-words-and-credentials")

    monkeypatch.setattr(adapter, "prepare_artifacts", fail)
    assert check.main(["--download-only"]) == 1
    output = capsys.readouterr().out
    assert "private-words-and-credentials" not in output
    assert json.loads(output)["error_type"] == "RuntimeError"
