"""Isolated, versioned audio gate. No API, diary, LLM or database imports.

VAD estimates speech activity, not speaker count, language, SNR or clinical state.
Energy/pauses and DAM input use the full normalized audio, without VAD cropping.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from functools import lru_cache
import importlib.metadata
import io
import json
import math
from pathlib import Path
import subprocess
import tempfile
import threading
import wave

from . import dam_adapter

RATE = 16000
MAX_BYTES = 10 * 1024 * 1024
MAX_SAMPLES = 120 * RATE
_VAD_LOCK = threading.Lock()


@dataclass(frozen=True)
class QualityPolicy:
    version: str = 'numa-audio-gate-v1'
    min_speech_sec: float = 30.0
    speech_threshold: float = 0.5
    min_speech_ms: int = 250
    min_silence_ms: int = 100
    min_rms: float = 0.005
    max_clipping_ratio: float = 0.1

    def __post_init__(self):
        if (not math.isfinite(self.min_speech_sec) or not 0 < self.min_speech_sec <= 120
                or not 0.15 < self.speech_threshold < 1
                or not 0 < self.min_speech_ms <= 1000
                or not 0 < self.min_silence_ms <= 1000
                or not 0 < self.min_rms < 1
                or not 0 <= self.max_clipping_ratio < 1):
            raise ValueError('invalid_quality_policy')


class AudioRejected(ValueError):
    """Only fixed, public reason codes; never embed input paths/content."""


def decode_audio(data: bytes):
    """Bounded WAV/WebM/MP4 decoding, mono16k PCM; reject overlength, never trim."""
    import numpy as np

    if not data:
        raise AudioRejected('empty_audio')
    if len(data) > MAX_BYTES:
        raise AudioRejected('audio_too_large')
    if data[:4] == b'RIFF' and data[8:12] == b'WAVE':
        try:
            with wave.open(io.BytesIO(data)) as source:
                if (source.getnchannels(), source.getframerate(), source.getsampwidth(),
                        source.getcomptype()) == (1, RATE, 2, 'NONE'):
                    frames = source.getnframes()
                    if frames > MAX_SAMPLES:
                        raise AudioRejected('audio_too_long')
                    pcm = source.readframes(frames)
                    if len(pcm) != frames * 2:
                        raise AudioRejected('decode_failed')
                    if not frames:
                        raise AudioRejected('empty_audio')
                    return np.frombuffer(pcm, dtype='<i2').astype(np.float32) / 32768
        except (wave.Error, EOFError):
            raise AudioRejected('decode_failed') from None
    elif not (data[:4] == b'\x1aE\xdf\xa3' or data[4:8] == b'ftyp'):
        raise AudioRejected('unsupported_format')
    # Input and output are bounded. No shell, playlists or network protocols.
    with tempfile.TemporaryDirectory(prefix='numa-decode-') as folder:
        source = Path(folder) / 'input.media'
        source.write_bytes(data)
        try:
            decoded = subprocess.run([
                'ffmpeg', '-nostdin', '-hide_banner', '-v', 'error', '-xerror',
                '-protocol_whitelist', 'file,pipe', '-format_whitelist', 'wav,matroska,webm,mov',
                '-i', str(source), '-map', '0:a:0', '-vn', '-sn', '-dn',
                '-t', '120.0000625', '-ac', '1', '-ar', str(RATE), '-f', 's16le', 'pipe:1',
            ], capture_output=True, timeout=30, check=False)
        except subprocess.TimeoutExpired:
            raise AudioRejected('decode_timeout') from None
        if decoded.returncode or len(decoded.stdout) % 2:
            raise AudioRejected('decode_failed')
        samples = np.frombuffer(decoded.stdout, dtype='<i2').astype(np.float32) / 32768
    if not len(samples):
        raise AudioRejected('empty_audio')
    if len(samples) > MAX_SAMPLES:
        raise AudioRejected('audio_too_long')
    return samples


@lru_cache(maxsize=1)
def vad_manifest():
    return json.loads(Path(__file__).with_name('vad_manifest.json').read_text('utf-8'))


@lru_cache(maxsize=1)
def _load_vad():
    """Verify installed source and bundled weights before import/JIT execution."""
    spec = vad_manifest()
    distribution = importlib.metadata.distribution('silero-vad')
    if distribution.version != spec['version']:
        raise ValueError('unexpected_vad_version')
    dam_adapter.verify_files(Path(distribution.locate_file('silero_vad')), spec['files'])
    import torch
    previous_threads = torch.get_num_threads()
    try:
        from silero_vad import get_speech_timestamps, load_silero_vad
        model = load_silero_vad(onnx=False)
        model.eval()
        for parameter in model.parameters():
            parameter.requires_grad_(False)
    finally:
        # Upstream import sets the process thread count; preserve the caller's setting.
        torch.set_num_threads(previous_threads)
    return model, get_speech_timestamps


def detect_speech(samples, policy: QualityPolicy):
    import torch

    # The recurrent state is reset by upstream for each file; serialize shared use.
    with _VAD_LOCK, torch.inference_mode():
        model, timestamps = _load_vad()
        return timestamps(torch.from_numpy(samples), model, sampling_rate=RATE,
                          threshold=policy.speech_threshold,
                          neg_threshold=policy.speech_threshold - 0.15,
                          min_speech_duration_ms=policy.min_speech_ms,
                          min_silence_duration_ms=policy.min_silence_ms,
                          speech_pad_ms=0, return_seconds=False)


def speech_metrics(intervals, sample_count: int):
    """Validate sample coordinates; sum without rounding at the eligibility boundary."""
    previous_end = 0
    total = 0
    for segment in intervals:
        start, end = segment['start'], segment['end']
        if not (isinstance(start, int) and isinstance(end, int)
                and previous_end <= start < end <= sample_count):
            raise ValueError('invalid_vad_intervals')
        total += end - start
        previous_end = end
    return total / RATE


def evaluate(data: bytes, policy: QualityPolicy = QualityPolicy(), *, confirmed_scope=False):
    """Return measurements plus temporary samples; scope is a caller assertion.

    confirmed_scope may only describe a controlled single-English-speaker fixture
    or a separately verified capture. It is NOT inferred by Silero.
    """
    import numpy as np

    result = {'policy': asdict(policy), 'vad': vad_manifest(), 'source': 'measured',
              'quality': 'not_evaluated', 'quality_flags': [], 'ml_status': 'failed',
              'speech_duration_sec': None, 'vad_verified': False,
              'scope_confirmed_by_caller': bool(confirmed_scope),
              'language_verified': False, 'speaker_count_verified': False,
              'snr_db': None, 'dam_called': False}
    try:
        samples = decode_audio(data)
        rms = float(np.sqrt(np.mean(samples.astype(np.float64) ** 2)))
        clipping = float(np.mean(np.abs(samples) >= .98))
        frames = samples[:len(samples) // 320 * 320].reshape(-1, 320)
        pause_ratio = (float(np.mean(np.sqrt(np.mean(frames ** 2, axis=1)) < .012))
                       if len(frames) else None)
        result['features'] = {'duration_sec': len(samples) / RATE, 'rms': rms,
                              'clipping_ratio': clipping, 'energy_pause_ratio': pause_ratio}
        flags = result['quality_flags']
        if rms < policy.min_rms:
            flags.append('silence_or_too_quiet')
        if clipping > policy.max_clipping_ratio:
            flags.append('heavy_clipping')
        if flags:
            result.update(quality='rejected', ml_status='quality_rejected')
            return result, samples
        intervals = detect_speech(samples, policy)
        seconds = speech_metrics(intervals, len(samples))
        result.update(quality='accepted', vad_verified=True,
                      speech_intervals_samples=intervals, speech_duration_sec=seconds,
                      speech_ratio=seconds / result['features']['duration_sec'])
        if seconds < policy.min_speech_sec:
            result.update(ml_status='insufficient_speech', quality_flags=['insufficient_speech'])
        elif not confirmed_scope:
            result.update(ml_status='scope_unverified', quality_flags=['scope_unverified'])
        else:
            result['ml_status'] = 'eligible'
        return result, samples
    except AudioRejected as exc:
        result.update(quality='rejected', ml_status='quality_rejected', quality_flags=[str(exc)])
    except Exception as exc:
        result.update(ml_status='failed', error_type=type(exc).__name__)
    return result, None


def gated_infer(data: bytes, cache: Path, policy: QualityPolicy = QualityPolicy(),
                *, confirmed_scope=False, run_dam=False):
    """No model call on rejection/failure; scores only exist after real success."""
    result, samples = evaluate(data, policy, confirmed_scope=confirmed_scope)
    if result['ml_status'] != 'eligible' or not run_dam:
        return result
    try:
        import numpy as np

        # Keep pauses and reference DAM file preprocessing; never concatenate speech.
        with tempfile.TemporaryDirectory(prefix='numa-gated-dam-') as folder:
            audio = Path(folder) / 'normalized.wav'
            with wave.open(str(audio), 'wb') as target:
                target.setnchannels(1)
                target.setsampwidth(2)
                target.setframerate(RATE)
                target.writeframes(np.rint(samples * 32768).clip(-32768, 32767).astype('<i2').tobytes())
            result['dam_called'] = True
            result['raw_scores'] = dam_adapter.infer(audio, cache, 'cpu')
        result['ml_status'] = 'completed'
    except Exception as exc:
        result.pop('raw_scores', None)
        result.update(ml_status='failed', error_type=type(exc).__name__)
    return result
