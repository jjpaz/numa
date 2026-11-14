# Numa

Para retomar el trabajo pendiente con Codex: **[NUMA_NEXT_STEPS.md](NUMA_NEXT_STEPS.md)** contiene el estado real, las fases de implementación de DAM, las integraciones pendientes y sus criterios de aceptación.

Referencia de diseño conservada: **[REDESIGN_BRIEF_JOURNAL.md](REDESIGN_BRIEF_JOURNAL.md)**. Sus rutas técnicas describen el prototipo de origen; la estructura actual se documenta aquí y en la guía de próximos pasos.

A private voice journal that learns a person's patterns and what they report finding helpful. Built as an independent Junction prototype with a patient portal and a psychologist portal.

The patient experience starts with a journal page and previous entries. In **Your space**, the person can choose sleep, movement, music, one small intention, personal patterns or voice observations. Nothing is unlocked by a mood score. **Today, something simple** temporarily hides optional modules while keeping their settings, entries and experiments. Invitations require recorded observations and can be dismissed. A botanical illustration remembers shared pages, with no streak loss or decline during absences.

Visual identity: Ivory `#F5E6C5`, Apricot `#D78B30`, Natural `#9F886F`, Organic `#3F422E`. Serif journal headings and paper edges distinguish the personal space from the professional overview.

## Run locally (Windows PowerShell)

Requirements: Node 20.19+ or 22.12+, Python 3.11+ for the API, and ffmpeg on PATH for browser recordings. The deployed SpeechBrain image specifically uses Python 3.11.

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

For the isolated DAM experiment (Python 3.11, CPU, no Gemini/database), see **[docs/ML_DAM.md](docs/ML_DAM.md)**. Its CLI is separate from the application's existing SpeechBrain adapter. Completing that check does not enable DAM in either portal.

The isolated **Modal/Linux CPU execution with real DAM weights** is also verified; see **[docs/ML_DAM_MODAL.md](docs/ML_DAM_MODAL.md)** for the lock, command, timings and limitations. It does not change the public demo or connect DAM to the journal.

The separate **VAD/audio-quality gate** has passed 19 controlled cases on Modal, including a real Chromium MediaRecorder file and DAM inference on the reference fixture. See **[docs/ML_VAD.md](docs/ML_VAD.md)**. Safari/physical microphone checks remain pending; the public journal still uses its existing audio path.

1. Activate the event's Gemini, Aiven and Modal offers (see `docs/RESOURCES.md`). None have been redeemed automatically.
2. Create one Aiven PostgreSQL service. Use its TLS connection URI with `postgresql://` or `postgresql+psycopg://` and certificate verification (`sslmode=verify-full` and the supplied CA if required). Never expose it to the browser.
3. Create Modal secret `numa-secrets` with values listed in `.env.production.example`. Set unique demo-account passwords and a random session secret. Set `NUMA_SEED_DEMO=true` for the fictional presentation profiles; the fresh profile never receives seeded history.
4. Install the Modal CLI in your deployment environment, authenticate, then run from the project root:

```powershell
python -m pip install modal
modal setup
modal deploy -m backend.modal_app
```

5. Put the returned backend origin (without `/api`) in Vercel's `VITE_API_BASE` variable. Set Modal's `NUMA_ALLOWED_ORIGINS` to the exact HTTPS frontend origin. Redeploy after changing frontend build variables. Vercel build command: `npm run build`; output: `dist`.
6. Run `python -m backend.smoke` with the same environment before presenting. This verifies PostgreSQL read-back, Gemini access and, with `--voice`, actual SpeechBrain loading/inference. It prints status only, not secrets or journal content.

`GEMINI_MODEL` defaults to `gemini-3.8-flash` from the planning-time official model catalogue. Access is account-dependent; set another supported Gemini audio-capable model if the smoke test rejects access. No other LLM provider is wired in. Model weights are cached in a Modal Volume; that volume is for model artifacts, not a second journal datastore. The API uses one Modal container to retain a bounded in-process processing queue; this is a demo architecture, not a durable job worker system.

## Verification

```powershell
npm run build
.\.venv\Scripts\python.exe -m pytest backend/tests -q
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
- Patient-selected disclosure, persistent simple-view preferences, optional habits and private experiments.
- Server-side authorization and a restrictive clinical projection; no private journal fields in psychologist endpoints.
- Five-second dashboard refresh, notes and printable observation report.
- Configured Gemini adapter, SpeechBrain inference adapter, PostgreSQL repository and Modal deployment definition.

## Boundaries

Sleep, weather, steps, outdoors and music are always simulated and labelled. Apple Health, Last.fm, calendar and wearable connections are future placeholders. The journal never asks for a mandatory mood score. A model category is an experimental vocal-expression output, not a depression probability, a truth detector or a substitute for a person's account. Helpfulness feedback and acoustic changes remain distinct observations.

Only fictional experiences should be entered into this publicly demonstrated prototype. Numa does not persist raw audio: it is held in memory during processing, passed to configured processors, then released. Provider-side retention follows provider account terms; this project does not claim zero retention by external services. Tokens last eight hours; there is no public registration. No automated medical escalation or medication advice is implemented.

See `NUMA_BUILD_BRIEF.md`, `docs/ARCHITECTURE.md`, `docs/DEMO.md`, and `docs/IMPLEMENTATION_LOG.md` for the handoff and current verification evidence.
