# DAM on Modal/Linux — isolated CPU validation

Date: 14 November 2026. Starting application checkpoint: `c460316`.
Work branch: `ml/modal-dam-check`. Public app `numa` is not redeployed by this check.

## What is verified

A real pinned DAM checkpoint loaded and executed in a remote Linux CPU container.
The controlled English TTS fixture produced finite raw outputs, and two consecutive
inferences in the same process agreed exactly. Inference ran with outbound network
blocked, using artifacts committed by a different preparation function to a Modal
Volume. The model was shared, frozen, in eval mode and used inference mode.

This establishes technical execution only, not clinical accuracy. DAM is not
connected to the journal, either portal, recommendations or patient history.
VAD, actual speech duration, speaker/language validation and clinical thresholds
are not implemented by this check. File duration is not speech duration.

## Reproducible configuration

- Modal CLI **1.6.4**, existing `.venv`; workspace/profile **rebollmartin**.
- Separate ephemeral Modal app: **numa-dam-validation**.
- Separate artifact-only Volume: **numa-dam-validation-weights**.
- Definition/entrypoint: `backend/ml/modal_check.py`.
- Python **3.11.18**, Debian trixie, Linux x86_64, glibc **2.41**.
- ML lock: `backend/ml/requirements-cpu-linux.lock.txt`. PyTorch/torchaudio
  **2.7.0+cpu**, Transformers **4.52.3**, PEFT **0.15.2**, huggingface-hub **0.31.4**,
  safetensors **0.5.3**, SoundFile **0.13.1**, NumPy **2.2.6**. The lock pins ML
  dependencies; Modal mounts its platform runtime separately. `pip check` passed.
- PyTorch CPU wheels come from the official CPU index; no CUDA/NVIDIA packages or
  GPU request. The Linux lock is separate from the verified Windows lock.
- DAM: `df83a1e00101d9c06a5042b96b921eb94d5a2528`.
- Whisper-small.en: `e8727524f962ee844a7319d92be39ac1bd25655a`.
- Pipeline: `numa-dam-standalone-v1`; unchanged adapter/preprocessing.
  Existing SHA-256 verification runs before executing DAM source/loading its
  checkpoint. The original cards and upstream source remain in the artifact cache.

The preparation function requests 1 CPU core / 1024 MiB and has a 600-second
timeout. It downloads the allowlisted artifacts and explicitly commits the Volume.
The check function requests 4 CPU cores / 8192 MiB, timeout 300 seconds, and runs
with `block_network=True`, `HF_HUB_OFFLINE=1` and `TRANSFORMERS_OFFLINE=1`.
Both have zero minimum/reserve containers, maximum one container, no retries and a
30-second idle window. The app stops when `modal run` ends; there is no public HTTP
endpoint, scheduler, GPU or permanently warm ML service.

The Volume retains approximately **1.70 GB** of checkpoint/Whisper weights plus small
metadata/source files (736,180,146 and 966,992,008 bytes for the two large files).
It contains no test audio or result scores. Storage persists after compute stops
and may have storage charges; deleting it is not part of this task. No actual bill
or general production cost benchmark was verified.

## Run from the repository root (Windows PowerShell)

Use the existing deployment `.venv` with Modal installed; the heavy ML packages
are built only in Modal, not installed into the API's local environment.

```powershell
.\.venv\Scripts\python.exe -m modal --version
.\.venv\Scripts\python.exe -m modal profile current
# Verify the intended cost owner/workspace before a paid run.
$env:MODAL_PROFILE = 'rebollmartin'
$env:PYTHONIOENCODING = 'utf-8'
.\.venv\Scripts\python.exe -m modal run -m backend.ml.modal_check --audio .local/ml-fixtures/synthetic-en.wav --report .local/ml-results/dam-modal-linux-NEW.json
```

Choose a **new** report filename for each run. The entrypoint validates the report
location and fixture before paid RPC calls; existing reports are never overwritten.
It only uploads the explicitly supplied WAV. Use the controlled synthetic fixture,
not patient recordings. To recreate that fixture on Windows if needed:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/make-ml-fixture.ps1
```

The generator refuses existing targets. An already generated WAV can be uploaded
from any compatible host; neither Windows TTS nor local `.venv-ml` is required by
the Linux runtime. Fixture: mono 16 kHz PCM16 WAV, **57.095 seconds**, 1,827,086 bytes;
SHA-256 `05e22f170a9cb7c817754eb44024d468bede1e1b7ca6070dfeafa906e2fe3789`.
Its fictitious English text and synthetic voice are not a patient evaluation set.

The first RPC prepares/downloads/commits weights. A second RPC in another container
loads them offline and performs two actual inferences. Temporary audio is outside
the Volume and removed when the temporary directory exits. No app secret is
attached and no FastAPI/repository/analysis module is imported.

Raw `depression`/`anxiety` floats go only into the explicitly selected ignored local
JSON report. Stdout redacts them and upstream model output is suppressed. Do not
print, publish or commit the private report. These arbitrary raw scales are not
probabilities, PHQ/GAD scores, diagnoses or statements about the synthetic speaker.

## Observed measurements

Both remote runs completed successfully:
[initial run](https://modal.com/apps/rebollmartin/main/ap-jUR8JP063KjwEyDxWML7en)
and [final pinned-version run](https://modal.com/apps/rebollmartin/main/ap-FNMjzQ10t1PaE3IHQTD2cX).
The final run used a fresh app and reused the Volume populated by the initial run.

| Measurement | Initial run | Final pinned-version run |
|---|---|---|
| Prepare artifacts + integrity + commit | 16.585 s (download) | 2.285 s (cached) |
| Load model from committed Volume | 10.469 s | 6.861 s |
| First / repeated inference | 7.775 / 6.900 s | 6.932 / 6.898 s |
| Total check-function time | 27.906 s | 23.108 s |
| Maximum absolute repeat difference | 0.0 | 0.0 |
| Peak process RSS | 3264.71 MiB | 3271.11 MiB |
| Finite values / eval / frozen / model reused | All true | All true |
| CUDA available | False | False |
| Independent of application imports | True | True |
| File speech duration / VAD | null / false (not verified) | null / false (not verified) |

These are individual technical observations, not a throughput, accuracy or cost
benchmark. Check-function timing excludes build, scheduling, input transfer and
preparation. Peak RSS is process memory, not the Modal bill or container allocation.
The initial run selected Python 3.11 and observed 3.11.18. The final run verified
the explicit Python 3.11.18 pin in a rebuilt image, `im-1xsMMSLgAc1vfT3uLhZoAP`.
Both apps were subsequently listed as **stopped**, with **0 tasks**. No public app
was redeployed and no inference service is left running.

Private reports: `.local/ml-results/dam-modal-linux-20261114-01.json` and
`.local/ml-results/dam-modal-linux-20261114-02.json`. No raw scores are in this
document.

## Tests and unchanged-demo checks

```powershell
.\.venv\Scripts\python.exe -m pytest backend/ml/tests -q
.\.venv\Scripts\python.exe -m pytest backend/tests backend/ml/tests -q
```

Baseline ML suite: **18 passed, 1 skipped**. After adding two deployment privacy /
import-boundary checks: **20 passed, 1 skipped**. Combined API/ML suite: **54 passed,
2 skipped**, with existing Starlette/httpx and Python/Modal deprecation warnings.
Skipped: dedicated PostgreSQL test and opt-in local real-model test. Remote real
inference above is independently executed; mocks do not supply its results.

Post-run public HTTP checks: backend health **200/ok**, demo/ephemeral memory,
name-only login enabled, Gemini off and app voice model disabled; frontend login
route **200**. `git diff` confirms no changes to `backend/modal_app.py`, API,
application analysis or frontend sources relative to `c460316`. No live sessions,
journals or user preview processes were modified by the validation. No frontend
build/browser suite was repeated because application code did not change.

Follow-up: the isolated phase-B VAD/quality gate now has its own verified synthetic
Modal battery; see [ML_VAD.md](ML_VAD.md). Actual browser/device capture acceptance
remains pending. Full DAM integration into the journal and connected deployments
remain later work; this isolated pass does not complete all of phase F.

References: [Modal resources](https://modal.com/docs/guide/resources),
[model artifact Volumes](https://modal.com/docs/guide/volumes),
[official CPU PyTorch releases](https://pytorch.org/get-started/previous-versions/),
and the pinned model references/licensing in [ML_DAM.md](ML_DAM.md).
