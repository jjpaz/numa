"""Controlled synthetic fixture battery; separate from application processing."""
from __future__ import annotations

import contextlib
import hashlib
import io
import subprocess
import tempfile
from pathlib import Path
import time
import wave

from . import audio_quality as quality

FIXTURE_SHA256 = '05e22f170a9cb7c817754eb44024d468bede1e1b7ca6070dfeafa906e2fe3789'


def pcm_wav(samples):
    import numpy as np

    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as target:
        target.setnchannels(1)
        target.setsampwidth(2)
        target.setframerate(quality.RATE)
        target.writeframes(np.rint(samples * 32768).clip(-32768, 32767).astype('<i2').tobytes())
    return buffer.getvalue()


def encode(samples, container):
    """Codec compatibility fixtures; these are not actual Safari captures."""
    with tempfile.TemporaryDirectory(prefix='numa-codec-fixture-') as folder:
        source, target = Path(folder) / 'input.wav', Path(folder) / ('output.' + container)
        source.write_bytes(pcm_wav(samples))
        options = (['-c:a', 'libopus', '-b:a', '64k'] if container == 'webm'
                   else ['-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart'])
        subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-i', str(source),
                        '-ac', '2', '-ar', '48000', *options, str(target)],
                       check=True, capture_output=True, timeout=30)
        return target.read_bytes()


def second_voice():
    """A second synthetic English voice for characterization, not diarization."""
    text = (
        'This synthetic recording is a software test, not a patient journal. '
        'The library has a blue door and a large window. A notebook sits beside '
        'a pencil on the desk. Outside the station, a bus stops near the garden. '
        'Tomorrow a visitor will return two books and check the train timetable. '
    ) * 3
    with tempfile.TemporaryDirectory(prefix='numa-tts-fixture-') as folder:
        target = Path(folder) / 'second.wav'
        subprocess.run(['espeak-ng', '-v', 'en-us', '-s', '145', '-w', str(target), '--stdin'],
                       input=text.encode(), capture_output=True, check=True, timeout=30)
        return quality.decode_audio(target.read_bytes())


def build_cases(primary: bytes, browser: bytes | None = None):
    import numpy as np

    if hashlib.sha256(primary).hexdigest() != FIXTURE_SHA256:
        raise ValueError('expected_controlled_synthetic_fixture')
    samples = quality.decode_audio(primary)
    segments = quality.detect_speech(samples, quality.QualityPolicy())

    def padded_prefix(target_seconds):
        remaining = round(target_seconds * quality.RATE)
        for segment in segments:
            length = segment['end'] - segment['start']
            if remaining <= length:
                end = segment['start'] + remaining
                return np.pad(samples[:end], (0, 60 * quality.RATE - end))
            remaining -= length
        raise ValueError('fixture_has_insufficient_speech')

    rng = np.random.default_rng(20261114)
    n = 60 * quality.RATE
    noise = rng.normal(0, .05, n).astype(np.float32)
    clock = np.arange(n) / quality.RATE
    # Original synthesized melody, not a licensed music recording.
    frequencies = np.array([261.63, 329.63, 392, 523.25])
    notes = frequencies[(clock.astype(int) // 2) % len(frequencies)]
    melody = (.12 * np.sin(2 * np.pi * notes * clock) *
              np.minimum(1, (clock % 2) * 10) * np.minimum(1, (2 - clock % 2) * 3))
    other = second_voice()
    multiple = np.concatenate([samples[:30 * quality.RATE], other[:30 * quality.RATE]])
    cases = [
        ('single_english_tts', primary, True, 'eligible'),
        ('below_threshold', pcm_wav(padded_prefix(29.5)), True, 'insufficient_speech'),
        ('above_threshold', pcm_wav(padded_prefix(30.5)), True, 'eligible'),
        ('long_with_little_speech', pcm_wav(padded_prefix(5)), True, 'insufficient_speech'),
        ('silence', pcm_wav(np.zeros(n)), True, 'quality_rejected'),
        ('quiet_speech', pcm_wav(samples * .001), True, 'quality_rejected'),
        ('heavy_clipping', pcm_wav(np.tile([1., -1.], n // 2)), True, 'quality_rejected'),
        ('white_noise', pcm_wav(noise), False, 'insufficient_speech'),
        ('synthetic_melody', pcm_wav(melody), False, 'insufficient_speech'),
        ('noise_plus_speech', pcm_wav(np.clip(samples + noise[:len(samples)], -1, 1)), False, None),
        ('two_synthetic_english_voices', pcm_wav(multiple), False, 'scope_unverified'),
        ('webm_opus_ffmpeg', encode(samples, 'webm'), True, 'eligible'),
        ('mp4_aac_ffmpeg', encode(samples, 'mp4'), True, 'eligible'),
        ('invalid_container', b'\x1aE\xdf\xa3invalid-test-container', True, 'quality_rejected'),
        ('truncated_wav', primary[:-10000], True, 'quality_rejected'),
        ('over_duration', pcm_wav(np.zeros(121 * quality.RATE)), True, 'quality_rejected'),
        ('over_upload_limit', b'x' * (quality.MAX_BYTES + 1), True, 'quality_rejected'),
        ('compressed_over_duration', encode(np.zeros(121 * quality.RATE), 'webm'), True, 'quality_rejected'),
    ]
    if browser is not None:
        cases.append(('chromium_mediarecorder', browser, True, 'eligible'))
    return cases


def run_suite(primary: bytes, cache: Path, *, browser: bytes | None = None, run_dam=False):
    """Run actual Silero on controlled cases; only the baseline may invoke DAM."""
    import torch

    torch.set_num_threads(1)
    started = time.perf_counter()
    rows = []
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        cases = build_cases(primary, browser)
        for label, payload, scope, expected in cases:
            tick = time.perf_counter()
            report = quality.gated_infer(payload, cache, confirmed_scope=scope,
                                         run_dam=run_dam and label == 'single_english_tts')
            actual_expected = 'completed' if run_dam and label == 'single_english_tts' else expected
            passed = (report['ml_status'] == actual_expected if actual_expected else
                      report['ml_status'] in {'scope_unverified', 'insufficient_speech', 'quality_rejected'})
            if label != 'single_english_tts' and (report['dam_called'] or 'raw_scores' in report):
                passed = False
            rows.append({'case': label, 'expected_status': actual_expected,
                         'passed': passed, 'elapsed_sec': round(time.perf_counter() - tick, 3),
                         'input_sha256': hashlib.sha256(payload).hexdigest(), **report})
        # A second file must not inherit the state of the previous file.
        repeat, _ = quality.evaluate(primary, confirmed_scope=True)
        initial = rows[0]
        repeatable = (repeat.get('speech_intervals_samples') == initial.get('speech_intervals_samples')
                      and repeat.get('speech_duration_sec') == initial.get('speech_duration_sec'))
    return {'status': 'completed' if all(x['passed'] for x in rows) and repeatable else 'failed',
            'cases': rows, 'repeatable_intervals': repeatable,
            'total_sec': round(time.perf_counter() - started, 3),
            'cuda_available': torch.cuda.is_available(),
            'actual_safari_capture_verified': False,
            'actual_chromium_capture_verified': browser is not None,
            'clinical_accuracy_verified': False}


def public_summary(result):
    """Only allowlisted aggregate test fields; no scores, intervals or input paths."""
    return {key: result.get(key) for key in ('status', 'repeatable_intervals', 'total_sec',
                                            'cuda_available', 'error_type')} | {
        'cases': [{key: row.get(key) for key in ('case', 'passed', 'ml_status',
                                                'speech_duration_sec', 'quality_flags',
                                                'dam_called', 'elapsed_sec')}
                  for row in result.get('cases', [])]}
