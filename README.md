# Numa

Para retomar el trabajo pendiente con Codex: **[NUMA_NEXT_STEPS.md](NUMA_NEXT_STEPS.md)** contiene el estado real, las fases de implementación de DAM, las integraciones pendientes y sus criterios de aceptación.

Referencia de diseño conservada: **[REDESIGN_BRIEF_JOURNAL.md](REDESIGN_BRIEF_JOURNAL.md)**. Sus rutas técnicas describen el prototipo de origen; la estructura actual se documenta aquí y en la guía de próximos pasos.

A private voice journal that learns a person's patterns and what they report finding helpful. Built as an independent Junction prototype with a patient portal and a psychologist portal.

The patient portal has three places: **Home** (record or write in the mailbox, review, then plant the entry), **My journal** (saved entries), and **My garden** (What helps, Connections and optional Your space modules). Nothing is unlocked by a mood score. Invitations require recorded observations and can be dismissed. Plants remember shared pages, with no streak loss or decline during absences. The old simple-mode control has been removed from the interface.

The patient portal uses the cream/forest/peach palette; the public pages and clinic retain their paper/moss/apricot identity. [DESIGN.md](DESIGN.md) documents the current routes, tokens and transitions. [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) distinguishes the connected application from isolated ML experiments.

## Run locally (Windows PowerShell)

Requirements: Node 20.19+ or 22.12+, Python 3.11+ for the API, and ffmpeg on PATH for browser recordings. The public Modal API uses Python 3.11 on CPU with vocal ML disabled; isolated DAM/VAD has its own pinned dependencies.

```powershell
cd C:\JUNCTION\numa
npm install
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
$env:NUMA_DEMO_MODE = 'true'
.\.venv\Scripts\python.exe -m uvicorn backend.app:create_app --factory --host 127.0.0.1 --port 8000
```

In another terminal:

```powershell
cd C:\JUNCTION\numa
npm run dev
```

Open http://127.0.0.1:5173. Vite proxies `/api` to the backend. Microphones require localhost or HTTPS. Browser audio is real; no synthetic waveform is substituted for recording.

After installing dependencies, `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-local.ps1` starts both preview servers in hidden background windows and prints their PIDs. Logs are in `.local/`; stop those exact processes when finished. The helper deliberately uses ephemeral preview storage.

Local preview accounts:

| Account | Email | Password |
|---|---|---|
| Fresh patient | patient@numa.demo | journal-demo |
| Read-only fictional journal | sample@numa.demo | sample-demo |
| Psychologist | psychologist@numa.demo | care-demo |

The preview explicitly uses ephemeral process memory, not a second persistent database. Restarting resets preview entries. PostgreSQL on Aiven is the sole persistent datastore in connected mode. No emotional ML is claimed in local preview: it measures duration, energy and pauses, and labels model inference as not configured. Without Gemini, voice transcription is unavailable; type or edit the words to finish the journal flow. Written notes use a transparent text passthrough in local preview and never invent feeling labels.

## Connected mode

The connected deployment was verified with Aiven PostgreSQL persistence, Gemini transcription/summaries and name-only presentation access in the integration record for `8b6859b`. The public API keeps `NUMA_DEMO_MODE=false` and `NUMA_ML_ENABLED=false`. Recovering the ML experiments does not enable them or redeploy the application. See [docs/IMPLEMENTATION_LOG.md](docs/IMPLEMENTATION_LOG.md) for historical live checks and [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) for current source validation.

For the isolated DAM experiment (Python 3.11, CPU, no Gemini/database), see **[docs/ML_DAM.md](docs/ML_DAM.md)**. Its CLI is separate from the application's existing SpeechBrain adapter. Completing that check does not enable DAM in either portal.

The isolated **Modal/Linux CPU execution with real DAM weights** is also verified; see **[docs/ML_DAM_MODAL.md](docs/ML_DAM_MODAL.md)** for the lock, command, timings and limitations. It does not change the public demo or connect DAM to the journal.

The separate **VAD/audio-quality gate** has a recorded 19-case Modal validation, including a real Chromium MediaRecorder file with synthetic input and DAM inference on the reference fixture. See **[docs/ML_VAD.md](docs/ML_VAD.md)**. The user reported a working Safari recording UI; VAD/DAM over a real Safari file is still unverified. These historical remote tests were not rerun during branch recovery.

To reproduce the connected deployment in an authorized environment:

1. Use the team's configured Gemini, Aiven and Modal accounts. Event offer information is in `docs/RESOURCES.md`; a working service does not prove that an offer was redeemed.
2. Use the Aiven PostgreSQL TLS URI with `postgresql://` or `postgresql+psycopg://`, `sslmode=verify-full` and the supplied CA when required. Never expose it to the browser. Tests use a different database through `TEST_DATABASE_URL`.
3. Configure the existing Modal secret `numa-secrets` from `.env.production.example` / `backend/connected.env.example`. Keep `NUMA_DEMO_MODE=false`, `NUMA_ML_ENABLED=false`, unique account passwords and a random session secret. `NUMA_DEMO_NAME_LOGIN=true` explicitly enables open presentation access with shared demo profiles; names are not separate private accounts. Keep `NUMA_SEED_DEMO=true` only for the fictional presentation profiles.
4. Install and authenticate the Modal CLI if needed, then deploy from the project root when a deployment is intended:

```powershell
python -m pip install modal
modal setup
modal deploy -m backend.modal_app
```

5. Put the returned backend origin (without `/api`) in Vercel's `VITE_API_BASE` variable. Set Modal's `NUMA_ALLOWED_ORIGINS` to the exact HTTPS frontend origin. Redeploy after changing frontend build variables. Vercel build command: `npm run build`; output: `dist`.
6. `python -m backend.smoke` checks PostgreSQL write/read/delete and Gemini JSON using the configured environment. It creates a verification record and makes a live provider request. Do not add `--voice` to the ML-disabled public setup: that legacy option targets SpeechBrain and is not a DAM test. DAM/VAD checks use the separate runbooks above.

`GEMINI_MODEL` has no guessed default: select and verify an accessible audio/JSON model explicitly. Gemini handles transcription and summaries; recommendation explanations use the deterministic rule's reason. The public API image has no model Volume or heavyweight ML installs. Only the isolated validation apps use an artifact-only Volume. The API uses one Modal container and bounded in-memory queues; pending writes are not durable during a database outage plus process loss.

## Verification

```powershell
npm run build
.\.venv\Scripts\python.exe -m pytest backend/tests backend/ml/tests -q
npm run test:e2e
```

E2E tests use installed Microsoft Edge in headless mode and start both local servers. Run with the local demo environment, not a production `.env`. On non-Windows environments adapt the backend `webServer.command` and browser channel in `playwright.config.ts`.

Browser tests use isolated ports **5174/8001**, leaving the user's preview on 5173/8000 untouched. Reduced motion keeps visual captures deterministic. When updating an already running ephemeral preview, `python -m backend.preview` backs up accessible journal state privately to ignored `.local/preview-restore.json`; start `uvicorn backend.preview:create_preview --factory` to restore it once. The backup is archived locally, never sent to the browser or committed. This explicit maintenance backup does not change connected-mode PostgreSQL persistence or raw audio retention.

Set `TEST_DATABASE_URL` to a dedicated PostgreSQL instance to enable the persistence integration test. It creates and removes only its own uniquely named verification record. API and browser tests otherwise use fresh, isolated in-memory fixtures.

## What is implemented

- Real microphone capture, waveform, replay/re-record, two-minute limit and written alternative.
- Separate vocal and explicit-language analysis, editable private transcript/summary, save/delete.
- Optional actions, preferences, helpfulness feedback and a separate voice comparison.
- A baseline from five distinct days, robust deviation observations and a three-observation review heuristic.
- Fictional longitudinal scenarios, a private page timeline, optional context and evidence-counted personal patterns.
- Patient-selected disclosure, optional modules, habits and private experiments; the removed simple-mode field remains only for backend compatibility.
- Server-side authorization and a restrictive clinical projection; no private journal fields in psychologist endpoints.
- Five-second dashboard refresh, notes and printable observation report.
- Connected Gemini/PostgreSQL backend and CPU Modal deployment with vocal ML disabled.
- Isolated DAM and Silero VAD validation tools, manifests, CPU locks and contract tests; no journal integration yet.

## Boundaries

Sleep, weather, steps, outdoors and music are always simulated and labelled. Apple Health, Last.fm, calendar and wearable connections are future placeholders. The journal never asks for a mandatory mood score. A model category is an experimental vocal-expression output, not a depression probability, a truth detector or a substitute for a person's account. Helpfulness feedback and acoustic changes remain distinct observations.

Only fictional experiences should be entered into this publicly demonstrated prototype. Numa does not persist raw audio: it is held in memory during processing, passed to configured processors, then released. Provider-side retention follows provider account terms; this project does not claim zero retention by external services. Tokens last eight hours; there is no public registration. No automated medical escalation or medication advice is implemented.

See `NUMA_BUILD_BRIEF.md`, `docs/ARCHITECTURE.md`, `docs/DEMO.md`, and `docs/IMPLEMENTATION_LOG.md` for the handoff and current verification evidence.
