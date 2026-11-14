"""Standalone DAM check. Stdout never contains audio paths or model scores."""
from __future__ import annotations

import argparse
from array import array
import importlib.metadata
import json
import math
from pathlib import Path
import platform
import sys
import time
import wave

from . import dam_adapter as adapter

PACKAGES = ("torch", "torchaudio", "transformers", "peft", "huggingface-hub",
            "safetensors", "soundfile", "numpy")


def inspect_audio(path: Path) -> dict:
    """Bounded PCM fixture validation, not VAD, language ID or diarization."""
    if path.stat().st_size > 10 * 1024 * 1024:
        raise ValueError("audio_too_large")
    with wave.open(str(path), "rb") as audio:
        if (audio.getnchannels(), audio.getframerate(), audio.getsampwidth(),
                audio.getcomptype()) != (1, 16000, 2, "NONE"):
            raise ValueError("expected_mono_16khz_pcm16_wav")
        duration = audio.getnframes() / 16000
        if not 30 <= duration <= 120:
            raise ValueError("expected_30_to_120_seconds")
        values = array("h", audio.readframes(audio.getnframes()))
        if sys.byteorder != "little":
            values.byteswap()
        if len(values) != audio.getnframes():
            raise ValueError("truncated_audio")
    energy = math.sqrt(sum(float(v) ** 2 for v in values) / len(values)) / 32768
    clipping = sum(abs(v) >= .98 * 32768 for v in values) / len(values)
    if energy < .005:
        raise ValueError("audio_too_quiet")
    if clipping > .1:
        raise ValueError("audio_heavily_clipped")
    return {"duration_sec": duration, "rms": energy, "clipping_ratio": clipping,
            "speech_duration_sec": None, "vad_verified": False}


def report_destination(path: Path) -> Path:
    resolved = path.resolve()
    allowed = [adapter.PROJECT_ROOT / ".local", adapter.PROJECT_ROOT / "model-cache"]
    if not any(resolved.is_relative_to(root.resolve()) for root in allowed):
        raise ValueError("report_must_be_in_ignored_local_directory")
    if resolved.exists():
        raise ValueError("report_already_exists")
    return resolved


def runtime_versions() -> dict:
    result = {"python": platform.python_version(), "platform": platform.platform()}
    for name in PACKAGES:
        try:
            result[name] = importlib.metadata.version(name)
        except importlib.metadata.PackageNotFoundError:
            result[name] = "not_installed"
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--audio", type=Path, help="Mono 16 kHz PCM16 WAV, 30–120s")
    source.add_argument("--download-only", action="store_true")
    parser.add_argument("--cache", type=Path, default=adapter.PROJECT_ROOT / "model-cache")
    parser.add_argument("--device", choices=("cpu", "cuda"), default="cpu")
    parser.add_argument("--threads", type=int, default=4)
    parser.add_argument("--report", type=Path,
                        help="Sensitive scores: new JSON under .local/ or model-cache/ only")
    args = parser.parse_args(argv)
    spec = adapter.manifest()
    result = {"status": "failed", "model": spec["model"],
              "model_revision": spec["revision"],
              "backbone_revision": spec["backbone"]["revision"],
              "pipeline_version": spec["pipeline_version"], "device": args.device,
              "runtime": runtime_versions()}
    started = time.perf_counter()
    destination = None
    try:
        if not 1 <= args.threads <= 32:
            raise ValueError("threads_must_be_between_1_and_32")
        if args.report:
            destination = report_destination(args.report)
        if args.download_only:
            adapter.prepare_artifacts(str(args.cache.resolve()))
            result["status"] = "downloaded_not_inferred"
        else:
            result["audio"] = inspect_audio(args.audio)
            import torch
            torch.set_num_threads(args.threads)
            load_started = time.perf_counter()
            adapter.load_pipeline(args.cache, args.device)
            result["load_sec"] = round(time.perf_counter() - load_started, 3)
            inference_started = time.perf_counter()
            result["raw_scores"] = adapter.infer(args.audio, args.cache, args.device)
            result["inference_sec"] = round(time.perf_counter() - inference_started, 3)
            result["status"] = "completed"
    except (ValueError, wave.Error, EOFError, FileNotFoundError):
        result["error"] = "input_or_artifact_validation_failed"
    except ImportError:
        result["error"] = "ml_dependencies_not_installed"
    except Exception as exc:
        # Exception messages can contain private paths, URLs or input data.
        result["error"] = "model_execution_failed"
        result["error_type"] = type(exc).__name__
    result["total_sec"] = round(time.perf_counter() - started, 3)
    if destination is not None:
        try:
            destination.parent.mkdir(parents=True, exist_ok=True)
            with destination.open("x", encoding="utf-8") as handle:
                json.dump(result, handle, indent=2, allow_nan=False)
            result["report_saved"] = True
        except OSError:
            result.pop("raw_scores", None)
            result["status"] = "failed"
            result["error"] = "report_write_failed"
    public = {key: value for key, value in result.items() if key != "raw_scores"}
    print(json.dumps(public, indent=2, allow_nan=False))
    return 0 if result["status"] in {"completed", "downloaded_not_inferred"} else 1


if __name__ == "__main__":
    raise SystemExit(main())
