# Implementation and verification record

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
