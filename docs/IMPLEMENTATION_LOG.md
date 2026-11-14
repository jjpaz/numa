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
