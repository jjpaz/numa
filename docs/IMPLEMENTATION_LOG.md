# Implementation and verification record

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
