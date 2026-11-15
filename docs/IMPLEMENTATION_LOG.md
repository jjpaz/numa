# Implementation and verification record

## Submission source synchronization and CI — 15 November 2026

- Added the already deployed named-patient, clinic-polling and branding fixes to
  the submission source change. The headline is “The journal that grows with you.”
  and the shared headers use the text-only numa wordmark.
- Rewrote the README around the live demo, a short patient/psychologist walkthrough,
  current behavior and portable local setup. Added a deployment guide and reconciled
  the status and architecture documents with the current routes and open name access.
  The visual video script remains a script; no recording, audio or subtitles were made.
- Added GitHub Actions for a Node 22 frontend build and Python 3.11 backend/isolated
  ML contracts. Actions are pinned to verified commit SHAs; checks need no production
  secrets and perform no deployment or real model inference.
- Local production build passed. Backend and isolated ML contracts: **116 passed,
  3 skipped**, with three existing dependency deprecation warnings. The skipped cases
  require a dedicated PostgreSQL database (two) or opt-in real DAM inference (one).
  The first sandbox attempt stalled in TestClient's internal socket setup; the retry
  outside that restriction passed with dotenv loading and external credentials disabled.
- Local documentation links and whitespace checks passed. A high-confidence credential
  pattern check found no matches in tracked or proposed source files; this was not a
  full Git-history secret audit.
- GitHub Actions [run 43660850177](https://github.com/jjpaz/numa/actions/runs/43660850177)
  passed both jobs; Linux/Python 3.11 reported 116 passed, 3 skipped.
- A fresh full Edge run could not complete: navigation through the local Vite server
  timed out at both 45 and 90 seconds. The first attempt did pass the slow-response
  clinic regression before it was stopped. No full browser pass is claimed for this
  submission run, and no product changes were made to work around the local blockage.
- Read-only public checks returned HTTP 200 for the frontend and a healthy API with
  connected PostgreSQL, Gemini configured, name login enabled and vocal ML disabled.

## Named demo patients linked to the practice — 15 November 2026

- Name-only patient login now creates or reopens a persistent profile and assigns
  it to the shared demo psychologist. Unicode, case and whitespace normalization
  prevent duplicate names; different names have distinct entry owners. Compact
  profile IDs keep even the longest accepted entry request IDs within PostgreSQL's
  existing 128-character key. No schema or provider configuration changed.
- Existing shared entries remain under Alex Morgan. Old named patient sessions
  receive 401 and must sign in again; password access to the legacy profile still
  works. Sample and psychologist names remain greeting aliases. The login now
  explains that anyone using the same demo name can reopen its journal.
- Backend suite: **71 passed**, including named-profile ownership, saved counts,
  clinical privacy, normalized re-entry, mock database restart/signing-key rotation,
  and legacy-session compatibility. Production frontend build and diff checks pass.
- Deployed the API to the existing Modal app and the frontend to the existing
  Vercel production project. Public browser verification created a unique fictional
  profile, wrote/reviewed/planted an entry through the mailbox, observed its name
  and saved count from an already-open psychologist session, and reopened the
  persisted PostgreSQL entry with different name casing. Clinical responses still
  exclude journal text. The verification entry was deleted afterward.

## Mailbox integration and isolated ML recovery — 14–15 November 2026

- PR #2 merged the complete patient mailbox branch and all pending connected
  backend/garden history into main (`01522d7`). Production build passed after
  `npm ci`. Existing API/ML contracts: 82 passed, 3 skipped. Edge full suite:
  30/31; the recording assertion expected an old disabled-ML label although
  audio measurements succeeded. After accepting the backend's actual label,
  recording and draft discard passed 2/2. No product behavior changed for that fix.
- Recovered only `3388445`, `2a4c8e6` and `8e3cd21`, retaining cherry-pick origin
  references. The only cherry-pick conflict was the implementation log; both the
  isolated experiment evidence and all connected-backend records were preserved.
  Rebased the recovered work onto the main produced by PR #2.
- Combined API and ML contract suite: **111 passed, 3 skipped**, three existing
  Starlette/Modal deprecation warnings. Command: `.\.venv\Scripts\python.exe -m
  pytest backend/tests backend/ml/tests -q --basetemp=.local/pytest-ml-recovery
  -o faulthandler_timeout=30`. Dedicated PostgreSQL checks (two) and opt-in real
  DAM inference (one) were skipped. `node --check
  scripts/make-vad-browser-fixture.cjs` passed.
- Recovery leaves the API runtime, deployment configuration, API requirements,
  frontend and environment templates unchanged. Gemini/Aiven stay connected;
  `NUMA_DEMO_MODE=false` and `NUMA_ML_ENABLED=false` remain in the public image.
  No production data, credentials, model weights or private reports were copied.
- Updated current guides to remove obsolete ephemeral-public-demo, missing
  Gemini/Aiven and unimplemented-ML-flag statements. The entries below are
  historical evidence from their respective checkpoints, not today's runtime.
  Remote DAM/VAD runs were not repeated and no service was redeployed here.
  Restoring the experiments does not authorize or implement DAM/VAD in the diary.

## Chromium MediaRecorder capture verified in Modal — 14 November 2026

- Base `2a4c8e6`, clean tree; branch `ml/vad-browser-check`. User authorized
  continuing the remaining work and requested progress/credit tracking. Browser
  execution was newly authorized after the previous rejected attempt.
- `node scripts/make-vad-browser-fixture.cjs`: **PASS**, Edge 157.0.4341.57,
  actual MediaRecorder/WebAudio using only the existing synthetic English fixture.
  Created ignored WebM/Opus, 842,832 bytes; no microphone or public Numa access.
  SHA-256 `ad21026d44785ab1d49c1095410540d901ba0f1e19c02a8d18fae69a9cfaa646`.
- Actual command with profile `rebollmartin` and UTF-8 output:
  `.\.venv\Scripts\python.exe -m modal run -m backend.ml.modal_vad_check --audio .local/ml-fixtures/synthetic-en.wav --browser-audio .local/ml-fixtures/chromium-synthetic.webm --report .local/ml-results/vad-browser-modal-20261114-01.json`.
  **PASS**, exit 0, **19/19 cases**;
  [run](https://modal.com/apps/rebollmartin/main/ap-Xscv7fKItnmWQRi9TTzbKK).
  Existing image reused, CPU/no GPU, minimum/reserve zero, offline inference.
- Chromium file decoded to 57.060 seconds, speech 40.704 seconds, clipping zero;
  status **eligible**, filter/decode 1.055 s. No DAM call requested for this new
  case; exactly one successful real DAM call on the reference TTS fixture.
  Whole suite 43.170 s, intervals repeatable, no API imports. Scores remain only
  in the ignored report; no audio saved in the model Volume.
- Final `modal app list --json` filtered to validation apps: **both stopped,
  0 tasks each**. No public deployment or application/frontend source changes.
- User confirmed a physical iPhone/Safari test: recording, playback and arrival at
  review all worked in the public demo. This is user-reported, not agent-observed.
  No claim of real Safari-file VAD validation, even if that manual UI test passes.
- Updated runbook and project progress. Backend tests not repeated because source
  is unchanged; previous actual result remains **81 passed, 2 skipped**. No Git push.
  Account credit readings are private session progress data, not committed here.

## Isolated phase-B VAD and audio-quality gate — 14 November 2026

- Started from clean `3388445` (`ml/modal-dam-check`); created `ml/vad-quality`.
  User authorized the next isolated VAD/quality block. No public demo deployment,
  frontend, API/domain/analysis logic, Gemini, Aiven or secret changes.
- Added `backend/ml/audio_quality.py`: bounded WAV/WebM/MP4 decoding to mono16k,
  existing RMS/clipping limits, versioned/configurable 30-second speech policy,
  unpadded Silero sample intervals, and a gate before optional real DAM execution.
  Full normalized audio retains pauses/energy and goes unchanged to DAM's reference
  preprocessing. No clinical categories, probabilities, thresholds or fake scores.
- Silero **6.2.3**, revision `5cd7945676eb32225748052e2e6a0580e4686a08`, MIT.
  Audited official wheel/source/license; wheel SHA-256
  `7b7f5436cfcb02fae583a05b512ea96467fd449fe54cb49a5e4f06c51a1e43b8`.
  Bundled JIT checkpoint SHA-256
  `e1122837f4154c511485fe0b9c64455f7b929c96fbb8d79fbdb336383ebd3720`.
  Runtime verifies source/checkpoint hashes before loading. Frozen CPU model,
  inference mode, serialized recurrent state and reset per file.
- GitHub's unauthenticated metadata API returned 403/rate limit once; read public
  Git tags and PyPI metadata instead. Installed only the pinned wheel into the
  existing isolated `.venv-ml`, using `pip install --no-deps` after verification.
  API `.venv` packages unchanged. Local `.venv-ml ... -m pip check`: **PASS**.
- First local VAD load returned `RuntimeError`: blanket `requires_grad_` is not
  supported by TorchScript modules. Changed freezing to each parameter; retry
  succeeded with **40.704 s** of estimated speech in the existing **57.095 s** TTS.
  No private recordings were processed. Optional second Windows English TTS voice
  was unavailable; reverted the generator change and generated the second controlled
  English voice with eSpeak NG inside Linux instead.
- Added `vad_validation.py` with 18 deterministic/controlled cases and
  `modal_vad_check.py`, app **numa-vad-validation**, workspace **rebollmartin**.
  Extracted the existing isolated DAM image's `base_image` for reuse; its original
  dependency/image definition and public `backend/modal_app.py` remain unchanged.
  New test image adds pinned Silero, FFmpeg and eSpeak NG (fixture generator only).
- Remote resources: CPU 4 / RAM 8192 MiB / timeout 300 s / retries 0 / minimum and
  reserve 0 / maximum 1 / idle 30 s / **no GPU**. Outbound network blocked, Hugging
  Face offline, no app secrets or HTTP endpoint. Reuses the previous artifact-only
  weights Volume; all audio is temporary outside it, and Silero is in the image.
- Actual remote command, with `MODAL_PROFILE=rebollmartin` and UTF-8 output:
  `.\.venv\Scripts\python.exe -m modal run -m backend.ml.modal_vad_check --audio .local/ml-fixtures/synthetic-en.wav --report .local/ml-results/vad-modal-20261114-01.json`.
  **PASS**, exit 0, **18/18 cases**;
  [run](https://modal.com/apps/rebollmartin/main/ap-dhJv8bSdLgnTACqgQrMAxI).
  Final image `im-1EccIn8NCKtu2K6lax4GCm`; Python 3.11.18, torch/torchaudio
  2.7.0+cpu, Silero 6.2.3, FFmpeg 7.1.5-0+deb13u1, eSpeak NG 1.52.0.
  Remote `pip check` passed. Other ML versions match the preceding verified lock.
- Real observations: 29.504 s of speech rejected; 30.496 s accepted; a 60-second
  file containing 5.056 s of speech rejected. Silence, quiet voice, clipping,
  corrupt/truncated containers, upload excess and overlength PCM/compressed audio
  rejected. White noise and synthesized melody detected as 0 speech. Stereo48k
  WebM/Opus and MP4/AAC created by FFmpeg normalized successfully (40.736 s speech).
- Noise plus voice (39.936 s) and two consecutive synthetic voices (48.416 s)
  demonstrate limits: VAD detects speech but not suitability, language or speaker
  count. They were excluded from DAM by the explicit caller-scope guard, **not**
  automatic noise/diarization detection. These are characterization fixtures only.
- Exactly one real DAM call: the principal controlled English fixture passed the
  gate and completed inference. Raw scores exist only for that case in the ignored
  report; the other 17 contain none. Public summaries use an allowlist. Repeating
  the primary VAD after the other cases yielded identical intervals/duration.
  Total remote suite **44.366 s**; first case including DAM/model load **27.267 s**;
  subsequent VAD cases approximately **0.83–1.37 s**. No isolated DAM latency,
  clinical accuracy, SNR, concurrent-load or cost benchmark claimed.
- `.\.venv\Scripts\python.exe -m modal app list --json`, filtered to this app:
  **stopped / 0 tasks**. No extra persistent Volume; previous weights cache retained.
- Local pytest attempts inside the sandbox blocked on TestClient's loopback
  socket (`socket._fallback_socketpair`); interrupted them. A desktop update also
  interrupted an approval/execution. Authorized execution outside the sandbox
  passed **80 tests / 2 skipped**; after adding the public-summary privacy check,
  final `.\.venv\Scripts\python.exe -m pytest backend/tests backend/ml/tests -q --basetemp=.local/pytest-vad-final -o faulthandler_timeout=30`:
  **81 passed, 2 skipped, 3 existing warnings**, 4.18 s. Skips: dedicated PostgreSQL
  and opt-in local DAM test. The new gate module alone passed **27 tests**.
- Attempt to run `node scripts/make-vad-browser-fixture.cjs` was rejected before
  opening Edge. Did not retry or use another capture tool. The optional script is
  prepared but **capture execution unverified**; `node --check` passed syntax only.
  No actual Chrome/Safari or physical microphone fixture was validated here.
  FFmpeg-produced formats are not substituted as evidence of real browser capture.
- Documented [ML_VAD.md](ML_VAD.md), updated reference guides/README/roadmap, and
  preserved all public source and existing synthetic fixture generator. No public
  HTTP or browser regression rerun; no user journal/session mutation. **The isolated
  core is verified; full phase-B acceptance still needs real browser/device captures.**
  Phase-C journal integration and provider work have not started. No Git push.

## Isolated DAM on Modal/Linux CPU — 14 November 2026

- Starting checkpoint: `c4603165170571480d4c26efb01e81ed7c02232c`, clean
  `deploy/modal-demo`; created `ml/modal-dam-check` for the explicitly authorized
  isolated Linux validation before phase B. Public demo remains the return point.
- Added `backend/ml/modal_check.py`, a separate authenticated RPC app,
  `numa-dam-validation`, with no public HTTP endpoint or app secrets. Added a
  Linux CPU dependency lock and two privacy/import-boundary tests. Existing DAM
  adapter, preprocessing, model manifest, API and frontend are unchanged.
- Modal CLI **1.6.4**, existing authenticated workspace **rebollmartin**. Verified
  Python **3.11.18**, Linux x86_64/glibc 2.41, torch/torchaudio **2.7.0+cpu**,
  Transformers **4.52.3**, PEFT **0.15.2**, huggingface-hub **0.31.4**, safetensors
  **0.5.3**, SoundFile **0.13.1**, NumPy **2.2.6**. Both remote builds passed
  `python -m pip check`; heavy ML packages were not installed into the API venv.
- DAM revision `df83a1e00101d9c06a5042b96b921eb94d5a2528`; Whisper revision
  `e8727524f962ee844a7319d92be39ac1bd25655a`; pipeline
  `numa-dam-standalone-v1`. Existing SHA-256 checks ran before model code/load.
- Used only the existing fictitious English TTS fixture, 57.095 seconds,
  mono/16 kHz/PCM16, SHA-256
  `05e22f170a9cb7c817754eb44024d468bede1e1b7ca6070dfeafa906e2fe3789`.
  No patient audio, credentials or application data were uploaded.
- Preparation: 1 CPU / 1024 MiB / timeout 600 seconds. Check: 4 CPU / 8192 MiB /
  timeout 300 seconds, `block_network=True` and both Hugging Face offline flags.
  Both functions use minimum/reserve 0, maximum 1, idle window 30 seconds,
  retries 0 and no GPU. Model artifacts are explicitly committed before a
  separate container loads them offline; temporary audio stays outside the Volume.
- Actual local commands and results:
  - `.\.venv\Scripts\python.exe -m modal --version` and
    `.\.venv\Scripts\python.exe -m modal profile current`: **1.6.4 / rebollmartin**.
  - `.\.venv\Scripts\python.exe -m pytest backend/ml/tests -q --basetemp=.local/pytest-dam-modal-baseline`:
    **18 passed, 1 skipped**.
  - `.\.venv\Scripts\python.exe -m pytest backend/ml/tests -q --basetemp=.local/pytest-dam-modal-contract`:
    **20 passed, 1 skipped** after the two new tests.
  - `.\.venv\Scripts\python.exe -m pytest backend/tests backend/ml/tests -q --basetemp=.local/pytest-dam-modal-final`:
    **54 passed, 2 skipped**, three existing Starlette/httpx and local Python/Modal
    deprecation warnings. Skipped dedicated PostgreSQL and opt-in local real-model
    checks; the remote real-model results below are separate, executed evidence.
- Actual remote command, with `$env:MODAL_PROFILE='rebollmartin'` and
  `$env:PYTHONIOENCODING='utf-8'`:
  `.\.venv\Scripts\python.exe -m modal run -m backend.ml.modal_check --audio .local/ml-fixtures/synthetic-en.wav --report .local/ml-results/dam-modal-linux-20261114-01.json`.
  **PASS**, exit 0; [initial run](https://modal.com/apps/rebollmartin/main/ap-jUR8JP063KjwEyDxWML7en).
  Preparation 16.585 s; load 10.469 s; real inference 7.775 / 6.900 s;
  total check 27.906 s; peak process RSS 3264.71 MiB.
- Pinned the observed interpreter to full `3.11.18` and executed the same command
  with `--report .local/ml-results/dam-modal-linux-20261114-02.json` in a fresh app.
  **PASS**, exit 0; [final run](https://modal.com/apps/rebollmartin/main/ap-FNMjzQ10t1PaE3IHQTD2cX).
  Image `im-1xsMMSLgAc1vfT3uLhZoAP`; cached preparation 2.285 s; load 6.861 s;
  real inference 6.932 / 6.898 s; total check 23.108 s; peak RSS 3271.11 MiB.
  The base-image build encountered transient package-mirror read timeouts and
  recovered through pip's automatic retries; neither remote command failed.
- Both runs: finite outputs, maximum absolute repeat difference **0.0**, model
  reused/frozen/eval all true, CUDA false, no API/analysis/repository imports.
  Raw scores are only in the ignored local JSON reports; terminal output redacts
  them. Reports are never overwritten. This is technical execution with synthetic
  English speech, not clinical validation, a throughput benchmark or billing proof.
- Final `.\.venv\Scripts\python.exe -m modal app list --json`, filtered to the
  validation app: **both stopped, 0 tasks each**. Retained artifact-only Volume
  `numa-dam-validation-weights`: approximately 1.70 GB of weights plus metadata;
  storage persists and may incur charges. No audio or scores are written there.
- Read-only public HTTP checks after the initial run: `Invoke-RestMethod
  https://rebollmartin--numa-api.us-east.modal.run/api/health` returned ok, ephemeral
  demo memory, name-only access enabled, Gemini/voice model disabled.
  `Invoke-WebRequest https://numa-one-xi.vercel.app/login/patient` returned **200**.
  Source diff against the starting checkpoint confirms no changes to public
  Modal configuration, API, application analysis, frontend or production env example.
  No public redeployment, session/journal mutation, frontend build or browser rerun.
- Added the reproducible runbook [ML_DAM_MODAL.md](ML_DAM_MODAL.md) and updated the
  README, prior DAM guide and roadmap. Next is **phase B: VAD/effective speech and
  quality**. VAD, speech duration, clinical validity, journal integration, Gemini,
  Aiven and the full connected backend remain unverified by this task. User-reported
  mobile recording is not an independent device test. No Git push occurred.

## Minimal connected backend: phase 3, Gemini contracts — 14 November 2026

- Previous phase committed as `25aa632`. Added model listing with pagination via
  Gemini's official models endpoint. API key is sent only in a header. A selected
  `GEMINI_MODEL` must be explicitly configured; removed the guessed model default.
  Requests use generateContent JSON MIME/schema, bounded output and connect/read
  timeouts. Provider failures/invalid JSON produce sanitized exceptions.
- Audio normalizes to temporary mono16k WAV in memory, then requests transcript
  JSON. Summary/feeling extraction receives text only. Successful transcription is
  now retained even if the subsequent summary call fails; manual transcript/summary
  edits still save and only text is re-evaluated.
- Added a conservative literal first-person English evidence guard. Ordinary events,
  negations, common quoted/conditional statements and other people's states are
  rejected. Unsupported wording/languages can omit genuine feelings; this is a
  conservative MVP filter, not validated semantic coverage or a clinical classifier.
- Added `backend.verify_gemini`: list accessible generation models, then verify a
  user-selected model using a real local Safari file plus JSON/text summary. Prints
  only statuses/model IDs, never words/key/path; metadata-only report under `.local`.
  A model's presence in the listing alone does not prove audio+JSON capability.
- Full backend test command for this phase was rejected before execution outside
  the sandbox. Did not retry it. Safe pure HTTP-mock subset executed inside sandbox:
  `.\.venv\Scripts\python.exe -m pytest backend/tests/test_gemini_connected.py -q
  -k 'not provider_failure_still_allows_save_and_summary_edits and not transcript_survives_summary_failure_and_edit_only_reanalyses_text'
  --basetemp=.local/pytest-min-connected-gemini-pure`: **11 passed, 4 deselected**,
  existing Starlette warning. Covers listing, audio JSON/text separation, schema
  failures and literal/no-feeling examples. Four API failure/edit cases are written
  with HTTP mocks but **no verificado** because their execution was not authorized.
- Real Gemini model listing/selection/audio/summary: **BLOQUEADA** (no API key).
  Model actually used: **none**. Real Safari transcription: **no verificado**;
  no Safari recording file has been supplied. Earlier iPhone UI confirmation is
  not evidence of transcription. No live Gemini requests or secret updates made.

## Minimal connected backend: phase 2, PostgreSQL contracts — 14 November 2026

- Previous phase committed as `cae8455`. PostgreSQL URLs now require explicit TLS;
  recommended Aiven mode `verify-full`. Optional `NUMA_DATABASE_CA_CERT` supplies
  CA PEM through the secret; it is written only to a temporary permission-limited
  certificate file and removed on repository close. Pool bounded to 2 connections,
  connect/statement timeouts 10 seconds, SQL parameters hidden from errors.
- Recoverable connection failures preserve JSON changes in a bounded **volatile**
  in-process queue (128 records), with `persistence_status=pending_retry` and an
  explicit restart-loss warning on entries. Later reads flush when DB recovers.
  Existing rows are not overwritten when an outage prevented checking identity:
  conflicting temporary words remain visible with `persistence_status=conflict`.
  Nonrecoverable errors/full buffers return sanitized 503; no false durable-save claim.
  PostgreSQL remains the only persistent datastore. Raw audio is never queued.
- Added tests for recoverable saves, unknown records, conflict preservation, owner
  isolation, deletion, bounded buffers and private-error redaction. Mock restart
  covers entries, feedback, professional notes, habits/growth, experiments/reflections
  and legacy entries. These tests are explicitly mocks, not Aiven verification.
- Clinical context/notes now use allowlists to prevent unexpected private fields
  from historical JSON escaping through nested containers. Tests recursively assert
  absence of transcript/transcription/summary/audio/experiments/questions/reflections,
  tags/explicit/model scores, plus role and owner restrictions.
- Real opt-in suite uses TEST_DATABASE_URL, checks it is a different database even
  if credentials/driver spelling differ, and creates only its own verification
  IDs/owner scope. Cleanup never purges tables. Production DATABASE_URL is never
  used as a test target.
- `.\.venv\Scripts\python.exe -m pytest backend/tests -q
  --basetemp=.local/pytest-min-connected-storage`: **48 passed, 2 skipped**, 2.37 s,
  existing Starlette warning. Both real PostgreSQL tests skipped because the URL
  is absent. Aiven CRUD/TLS/restart persistence: **BLOQUEADA / no verificado**.
- Fundamental limit: a database outage plus process/container loss cannot provide
  durable saves using only PostgreSQL. Pending entries are explicitly temporary;
  the existing frontend does not yet render these new persistence fields.

## Minimal connected backend: phase 1, ML deliberately disabled — 14 November 2026

- Starting branch `ml/vad-browser-check`, commit `8e3cd21`, clean tree. Created
  `backend/min-connected` directly from `main` at `d9fce5a`, as requested. Main was
  not modified and no experimental branch was merged. Isolated DAM/VAD work remains
  preserved on `ml/modal-dam-check`, `ml/vad-quality` and `ml/vad-browser-check`.
- Phase C cancelled. ML is future work: **evaluado, desactivado a propósito hasta
  validarlo**. API defaults to `NUMA_ML_ENABLED=false`; acoustic results keep
  `ml_status=not_configured`. No DAM/VAD pipeline is imported into the diary.
- Restored only the already-deployed additive backend name-login/session changes
  from `deploy/modal-demo` to preserve public demo compatibility; frontend untouched.
- Current public demo health: external `Invoke-RestMethod` returned ok, ephemeral
  demo memory, vocal model false and name-only login true. Modal 1.6.4, authenticated
  workspace `rebollmartin`. No deployment has occurred in this phase yet.
- Compared public source at `8e3cd21` with demo `d198df5`: API requirements identical;
  Modal image definition differs only by the later name-login flag, not ML packages.
  Main still had the old SpeechBrain/PyTorch/T4 definition; replaced it on this new
  branch with the demo CPU image, zero minimum/reserve, max one, idle 30 seconds,
  no GPU/model Volume/ML installs. Keep FFmpeg/libsndfile for audio decoding.
  Removed image overrides that emptied database/Gemini settings so secrets can
  configure connected mode. Image defaults preserve the current demo until then.
- Baseline from main: `.\.venv\Scripts\python.exe -m pytest backend/tests -q
  --basetemp=.local/pytest-min-connected-baseline`: **26 passed, 1 skipped**,
  existing Starlette warning. The omitted test needs a dedicated PostgreSQL URL.
- Credential presence checked without values in process environment and known local
  dotenv/credential files: DATABASE_URL, TEST_DATABASE_URL and GEMINI_API_KEY absent.
  Real Aiven and Gemini verification: **BLOQUEADA**. No values requested from user.
  Connected deployment/model listing/Safari-file transcription: **no verificado**.
- Phase-1 validation: `.\.venv\Scripts\python.exe -m pytest backend/tests -q
  --basetemp=.local/pytest-min-connected-ml-off`: **37 passed, 1 skipped** in 2.11 s,
  existing Starlette warning. Includes disabled-ML import/load boundary and
  CPU-image dependency checks, plus deployed name-login/session compatibility.

Date: 14 November 2026. All Numa source was created in a new project directory during this task. No earlier MVP source or brand assets were copied.

## Delivered

- Original React/TypeScript interface with a warm journal identity, responsive patient and psychologist portals, recording and editing flow, contextual cards, personal insights, preferences and future-connection cards.
- FastAPI API, signed demonstration sessions, patient ownership checks, psychologist assignment checks and an explicit clinical projection that excludes private journal fields.
- One PostgreSQL repository for connected mode; explicitly ephemeral process-memory fixtures for local preview. No SQLite, MongoDB or second persistent database.
- Gemini adapter with browser audio normalized to WAV, a separate text-only interpretation request, exact-evidence checks and optional recommendation explanation.
- SpeechBrain inference adapter and Modal deployment image. Model probabilities are distinct from acoustic trends and patient declarations; comparisons do not establish helpfulness.
- Five-day personal acoustic baseline, three-observation persistent-change heuristic, context-aware action ranking, feedback, optional voice comparisons, notes and print layout.
- Idempotent entry creation, partial-failure saving, interrupted-job recovery and recoverable microphone/provider errors.
- Setup/configuration templates, resource redemption and prize rationale, architecture, build brief, two-minute demo script and account-dependent smoke checks.

## Executed checks

| Check | Observed result |
|---|---|
| `npm run build` | Passed; production frontend generated successfully |
| `.venv/Scripts/python -m pytest backend/tests -q` | **19 passed, 1 skipped** |
| PostgreSQL integration test | Skipped because `TEST_DATABASE_URL` is not configured |
| `npm run test:e2e` | **5 passed** in headless Microsoft Edge |
| Privacy tests | Psychologist denied private-entry endpoints; private fields and canary text excluded from clinical responses |
| Signal separation | Contradictory mock vocal probabilities and explicit self-report retained independently; edits preserve voice measurements |
| Voice capture | Browser-generated microphone device recorded real media frames; FFmpeg/acoustic path and manual transcript recovery passed |
| Cross-session polling | Already-open psychologist portal received activity changes within the test's nine-second bound |
| Layout inspection | Desktop landing and sample journal/insights, mobile sample journal and psychologist dashboard inspected; mobile overflow checks passed |
| Local helper | PowerShell syntax checked and background preview processes started successfully |
| `python -m backend.smoke` | Reported NOT RUN because live Gemini/database credentials are absent |

Backend tests currently emit a dependency deprecation warning about Starlette's httpx TestClient. It did not fail any test. Browser tests use fake media devices explicitly and do not access the user's actual microphone.

Generated inspection images are in `test-results/numa-landing-desktop.png`, `numa-journal-desktop.png`, `numa-insights-desktop.png`, `numa-journal-mobile.png` and `numa-clinic-mobile.png`. These are ignored test artifacts, recreated by the browser suite.

## Not verified or activated

- No event credits redeemed or provider accounts created.
- No live Aiven read/write, Gemini request or SpeechBrain inference run with team credentials.
- The Modal image definition has not been built/deployed against a Modal account; dependency compatibility and cold-start latency still need the live smoke check.
- No public Vercel deployment, submission or organizer eligibility confirmation.
- Real mobile hardware, background-tab recording interruptions and the final printed report page count remain manual checks.

The local preview is labelled accordingly. It records audio and calculates acoustics, but does not silently substitute fake emotional ML or synthetic history for a new person's baseline. When Gemini is absent, entries can be written or manually corrected. Current preview entries disappear when the API process restarts.

## Development evidence

### Patient-led growth and visual revision — 14 November 2026

- Applied Ivory / Apricot / Natural / Organic throughout both portals, including the favicon, recording wave and botanical artwork. Added serif journal headings, paper edges and a quiet previous-page list.
- Replaced the initial patient dashboard with a page invitation and previous entries. Context, charts and patterns appear only after explicit choice. Added **Your space**, evidence-backed optional invitations, remembered dismissal and **Today, something simple** with restoration of previous choices.
- Added a plant illustration that remembers shared pages independently of emotional state or absences, one optional habit without a streak, and private personal experiments with pause/resume and a closing reflection.
- Added backend presentation preferences and private experiment records to the existing repository. No additional provider or database. Clinical projections remain unchanged and exclude all experiment questions/reflections.
- Updated the handoff and resource documentation. Added race protection so a background preferences refresh cannot undo a newer patient choice.
- Current verification: production build passed; **26 backend tests passed, 1 PostgreSQL test skipped**; browser suite expanded to **7 passing scenarios**, including progressive disclosure and optional habit/experiment workflows. Live external integrations remain unverified as previously recorded.
- Existing local state was backed up before the API restart, restored into the updated preview and retained as an ignored local archive. Browser tests now use separate ports to avoid affecting the preview.
- Browser setup checks that the frontend proxy targets its isolated API, clears test-session state and waits for exact authenticated routes (a suffix glob also matched `/login/patient`). The final complete seven-scenario run passed after this test-preparation correction. Desktop/mobile captures were inspected with reduced motion enabled.

Codex authored the new frontend, backend, authorization boundary, signal adapters, fixtures, deployment configuration and documentation; executed compiler, backend and browser checks; corrected test selectors, browser MIME normalization, stale-job recovery and configuration validation; and inspected generated desktop/mobile screenshots. This is a factual development record, not evidence that external integrations or clinical effectiveness have been validated.

### Phase A — standalone DAM, completed technical check — 14 November 2026

- Created `backend/ml/` with a lazy adapter and independent CLI. No API, database or Gemini imports/credentials are required. The application's analysis adapter and both portals remain unchanged.
- Audited DAM reference source at `df83a1e00101d9c06a5042b96b921eb94d5a2528`; pinned Whisper to `e8727524f962ee844a7319d92be39ac1bd25655a`. Recorded source/checkpoint SHA-256 digests in the manifest and verified them before loading. Downloaded only the required artifacts, preserving original model cards/attribution in ignored `model-cache/`.
- Isolated upstream generic imports in a private namespace, used the pinned local Whisper snapshot, enforced weights-only checkpoint loading, `eval()`, frozen parameters, inference mode and `quantize=False`. No category conversion or clinical thresholds are applied. Raw outputs are finite floats, never probabilities or PHQ/GAD scores.
- Reference environment: Windows x86_64, CPython 3.11.14, torch/torchaudio 2.7.0+cpu, transformers 4.52.3, peft 0.15.2, huggingface-hub 0.31.4, safetensors 0.5.3, SoundFile 0.13.1 and NumPy 2.2.6. `requirements-cpu-win.lock.txt` matches every package from `pip freeze`; `pip check` passed. This is not a verified Modal/CUDA environment.
- No registered Python 3.11 existed. uv 0.9.11's install failed on a Windows directory rename. Downloaded and directly extracted the same Astral CPython build, verified its archive digest, and created `.venv-ml` with its Python; existing `.venv` was not modified.
- Generated a **57.095-second synthetic English WAV** with an installed Windows TTS voice and fictitious technical text. No real journal or patient audio was read, submitted externally or added to Git.
- Actual commands/results: standalone `--download-only` passed; offline `--audio ... --report .local/ml-results/dam-first.json` completed with real weights; **6.796 seconds load**, **5.340 seconds inference**, **14.238 seconds total** in that initial process with weights cached. These are a single CPU observation, not a general latency benchmark.
- The CLI prints processing metadata, not audio paths, scores or exception messages. Scores require an explicit new report inside ignored `.local/` or `model-cache/`. The initial report is local only; no score is included in this log.
- Validation-only run: **18 passed, 1 real-model test skipped** in the existing environment. ML environment with `NUMA_RUN_DAM_REAL_TEST=1`, fixture selected explicitly and networking disabled: **19 passed**, including two real inferences, finite output, CPU repetition within absolute `1e-6`, and eval mode. Contract fixtures/mocks are separate from the real-model test.
- Final real-model rerun after explicitly freezing parameters and setting relative tolerance to zero: **1 passed in 31.25 seconds**; all parameters had `requires_grad=false` and both outputs agreed within absolute `1e-6`.
- Combined API/contract regression: **44 passed, 2 skipped** (PostgreSQL unavailable; model opt-in disabled). Initial sandbox execution stalled; the bounded retry passed all API checks but encountered permissions on Windows' shared pytest temp directory. Repeated with a new dedicated `.local/pytest-ml-combined-20261114-a` scratch directory: all 44 passed. Existing Starlette/httpx deprecation warning remains. Tests did not restart or modify the user's preview.
- Did not rerun frontend/browser suites because no frontend or API runtime code changed. The two handoff documents remain present; `NUMA_NEXT_STEPS.md` now starts the next session at phase B.

**Boundary and next step:** phase A proves technical execution only. File duration is not effective speech; CLI reports `vad_verified=false` and no speech-duration estimate. VAD, language/speaker/quality robustness, real-person evaluation, API integration, Gemini/Aiven access, Modal and public application deployment remain pending. Stop here before phase B to keep the completed section reviewable.

### Connected MVP integration and public deployment — 14 November 2026

- Merged Victor's final frontend through `2b92997`, including the voice-line landing page, patient garden/journal and professional psychologist portal, into `backend/min-connected`. Preserved account switching and added name-only login through the connected backend. The login waits for API configuration instead of briefly displaying a password form during startup.
- Kept Aiven PostgreSQL and Gemini real, with voice ML disabled. Set exact Vercel CORS origins in the private Modal secret; removed the image-level name-login override. Gemini is used for transcription and journal summaries; activity explanations use the existing deterministic reason. No retry-queue expansion or model-probing CLI was added. Credentials and test database configuration remain excluded from Git and frontend uploads.
- Validation: frontend production build passed; existing backend suite: 64 passed, 2 skipped. Updated existing login regression expectations and corrected an invalid underscore in an existing test request ID. Aiven's dedicated real persistence/restart test passed. Real Gemini transcription and summary passed with a 12-second synthetic fictional audio clip.
- Deployed the connected API at `https://rebollmartin--numa-api.us-east.modal.run` and frontend at `https://numa-one-xi.vercel.app`. The first Modal CLI attempt stopped on Windows output encoding; the UTF-8 invocation completed deployment. Live health confirms PostgreSQL, Gemini configuration, name login enabled, ML disabled and the exact public CORS origin.
- Public end-to-end API verification passed: name-only patient/psychologist authentication, audio transcription and summary, PostgreSQL save/read-back, psychologist saved-entry count increment and blocked clinician access to private journal endpoints. Deleted only the uniquely identified verification entry afterward. Browser verification confirmed the new landing page and name-only patient access to the garden.
