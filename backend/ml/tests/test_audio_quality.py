"""Gate/decoder contracts. Mock timestamps are not a real VAD evaluation."""
import io
from pathlib import Path
import subprocess
import sys
import wave

import numpy as np
import pytest

from backend.ml import audio_quality as quality


def wav(samples, rate=16000, channels=1):
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as handle:
        handle.setnchannels(channels)
        handle.setsampwidth(2)
        handle.setframerate(rate)
        handle.writeframes(np.asarray(samples, dtype='<i2').tobytes())
    return buffer.getvalue()


def tone(seconds=60):
    return np.rint(4000 * np.sin(np.arange(seconds * 16000) / 8)).astype('<i2')


@pytest.mark.parametrize('count,expected', [
    (30 * 16000 - 1, 'insufficient_speech'), (30 * 16000, 'eligible'),
    (30 * 16000 + 1, 'eligible'),
])
def test_sample_exact_threshold_and_original_pauses(count, expected, monkeypatch):
    monkeypatch.setattr(quality, 'detect_speech', lambda *args: [{'start': 0, 'end': count}])
    data = wav(np.concatenate([tone(40), np.zeros(20 * 16000)]))
    report, samples = quality.evaluate(data, confirmed_scope=True)
    assert report['ml_status'] == expected
    assert report['speech_duration_sec'] == count / 16000
    assert report['features']['duration_sec'] == 60
    assert report['features']['energy_pause_ratio'] >= 1 / 3
    assert len(samples) == 60 * 16000


@pytest.mark.parametrize('data,reason', [
    (b'', 'empty_audio'), (b'not an audio file', 'unsupported_format'),
    (b'x' * (quality.MAX_BYTES + 1), 'audio_too_large'),
    (wav(np.zeros(16000)), 'silence_or_too_quiet'),
    (wav(np.full(16000, 20)), 'silence_or_too_quiet'),
    (wav(np.tile([32767, -32768], 8000)), 'heavy_clipping'),
    (wav(np.zeros(121 * 16000)), 'audio_too_long'),
    (wav(tone(1))[:-100], 'decode_failed'),
])
def test_invalid_audio_never_loads_vad_or_dam(data, reason, monkeypatch):
    monkeypatch.setattr(quality, 'detect_speech', lambda *a: pytest.fail('VAD must not run'))
    monkeypatch.setattr(quality.dam_adapter, 'infer', lambda *a: pytest.fail('DAM must not run'))
    result = quality.gated_infer(data, Path('.'), confirmed_scope=True, run_dam=True)
    assert result['ml_status'] == 'quality_rejected'
    assert reason in result['quality_flags']
    assert result['dam_called'] is False
    assert 'raw_scores' not in result


def test_insufficient_speech_and_unverified_scope_never_call_dam(monkeypatch):
    monkeypatch.setattr(quality.dam_adapter, 'infer', lambda *a: pytest.fail('DAM must not run'))
    for duration, scope, expected in [(5, True, 'insufficient_speech'), (40, False, 'scope_unverified')]:
        monkeypatch.setattr(quality, 'detect_speech', lambda *a: [{'start': 0, 'end': duration * 16000}])
        result = quality.gated_infer(wav(tone()), Path('.'), confirmed_scope=scope, run_dam=True)
        assert result['ml_status'] == expected
        assert not result['dam_called'] and 'raw_scores' not in result
        assert result['language_verified'] is False and result['speaker_count_verified'] is False
        assert result['snr_db'] is None


def test_accepted_input_reaches_dam_intact_and_temporary_file_is_removed(monkeypatch):
    original = tone()
    paths = []
    monkeypatch.setattr(quality, 'detect_speech', lambda *a: [{'start': 0, 'end': 40 * 16000}])

    def infer(path, cache, device):
        paths.append(path)
        with wave.open(str(path), 'rb') as handle:
            assert handle.getnframes() == len(original)
            assert handle.readframes(len(original)) == original.tobytes()
        assert device == 'cpu'
        return {'depression': 1.25, 'anxiety': -0.75}

    monkeypatch.setattr(quality.dam_adapter, 'infer', infer)
    result = quality.gated_infer(wav(original), Path('.'), confirmed_scope=True, run_dam=True)
    assert result['ml_status'] == 'completed' and result['dam_called']
    assert result['raw_scores'] == {'depression': 1.25, 'anxiety': -0.75}
    assert paths and all(not path.exists() for path in paths)


def test_vad_failure_and_dam_failure_are_sanitized(monkeypatch):
    def fail(*args):
        raise RuntimeError('private-recording-contents')

    monkeypatch.setattr(quality, 'detect_speech', fail)
    result = quality.gated_infer(wav(tone()), Path('.'), confirmed_scope=True, run_dam=True)
    assert result['ml_status'] == 'failed' and not result['dam_called']
    assert 'private-recording-contents' not in str(result)
    monkeypatch.setattr(quality, 'detect_speech', lambda *a: [{'start': 0, 'end': 40 * 16000}])
    monkeypatch.setattr(quality.dam_adapter, 'infer', fail)
    result = quality.gated_infer(wav(tone()), Path('.'), confirmed_scope=True, run_dam=True)
    assert result['ml_status'] == 'failed' and result['dam_called']
    assert 'raw_scores' not in result and 'private-recording-contents' not in str(result)


@pytest.mark.parametrize('intervals', [
    [{'start': -1, 'end': 50}], [{'start': 0, 'end': 101}],
    [{'start': 0, 'end': 60}, {'start': 50, 'end': 100}],
    [{'start': 0, 'end': 0}], [{'start': 0.5, 'end': 10}],
])
def test_invalid_detector_coordinates_fail_closed(intervals):
    with pytest.raises(ValueError):
        quality.speech_metrics(intervals, 100)


@pytest.mark.parametrize('value', [0, -1, 121, float('nan'), float('inf')])
def test_invalid_threshold_configuration(value):
    with pytest.raises(ValueError):
        quality.QualityPolicy(min_speech_sec=value)


def test_import_does_not_load_api_or_models():
    code = ('import sys; import backend.ml.audio_quality; '
            'assert not {"torch", "silero_vad", "fastapi", "sqlalchemy", '
            '"backend.app", "backend.analysis", "backend.repository"}.intersection(sys.modules)')
    subprocess.run([sys.executable, '-c', code], check=True, capture_output=True, timeout=20)


def test_ffmpeg_decode_errors_are_not_exposed(monkeypatch):
    monkeypatch.setattr(quality.subprocess, 'run', lambda *a, **kw:
                        subprocess.CompletedProcess([], 1, b'', b'private-path'))
    result, _ = quality.evaluate(b'\x1aE\xdf\xa3invalid-container')
    assert result['quality_flags'] == ['decode_failed']
    assert 'private-path' not in str(result)


def test_remote_summary_excludes_nested_scores_and_intervals():
    from backend.ml.vad_validation import public_summary

    private = {'status': 'completed', 'cases': [{'case': 'synthetic', 'passed': True,
               'raw_scores': {'depression': 1.25}, 'speech_intervals_samples': [{'start': 0, 'end': 10}]}]}
    public = public_summary(private)
    assert 'raw_scores' not in str(public) and 'speech_intervals_samples' not in str(public)
    assert private['cases'][0]['raw_scores'] == {'depression': 1.25}
