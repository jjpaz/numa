# Numa — current project status

Updated **15 November 2026** for the Junction submission. This page describes the current application; older checkpoints remain in the [implementation log](IMPLEMENTATION_LOG.md).

**[Live demo](https://numa-one-xi.vercel.app)** · **[Source](https://github.com/jjpaz/numa)** · **[Deployment guide](DEPLOYMENT.md)**

## Application

| Area | Status |
|---|---|
| Patient frontend | Victor's mailbox and garden are integrated: Home, My journal, My garden and optional Your space modules. The simple-mode control is removed. |
| Branding | Text-only `numa` wordmark. Homepage and patient sign-in headline: “The journal that grows with you.” |
| Named demo patients | Each normalized patient name creates or reopens a persistent profile assigned to the shared demo psychologist. Different names own different entries. The same name grants access to the same demo profile without a password. |
| Earlier shared profiles | Existing shared entries remain under Alex Morgan. Legacy named patient sessions must sign in again; history is not reassigned to names without evidence of ownership. |
| Psychologist portal | Displays assigned patient names and saved-entry counts. Private journal text and experiment reflections are excluded. Polling waits for each request to finish, then delays five seconds; slow responses and recoverable failures no longer leave an endless loading state. |
| Gemini and Aiven | Real transcription/summaries and PostgreSQL persistence in the connected public demo. |
| Public deployment | Vercel frontend and Modal CPU API are published. The latest named-profile frontend deployment is `dpl_F4GaqRxJDRDWknHGGLkUn8BcLBQs`; endpoints and runtime settings are in the deployment guide. |
| Acoustic measurements | Duration, energy and pause estimates are measured from recordings. These are not diagnoses or emotional-model predictions. |
| Vocal ML | `NUMA_ML_ENABLED=false`. DAM and Silero VAD have independent experimental tools, manifests, dependency locks and historical technical checks. Neither is integrated into the journal. |
| Context and sample history | Sleep, steps, weather, outdoors and music are simulated. Longitudinal sample profiles are fictional. External wearable/music/calendar integrations are not active. |
| Demo video | The [visual script](DEMO.md) is prepared. Recording, narration and subtitles have not been produced. |

## Submission verification

- Production frontend build: passed.
- Backend and isolated ML contract tests: **116 passed, 3 skipped**. Dedicated PostgreSQL checks (two) and real DAM inference (one) are opt-in and were not run for this submission check. Provider tests use mocks; these counts do not claim new live Gemini or model execution.
- Browser regression suite: a fresh full local run could not complete because navigation through the local Vite development server timed out, including with a 90-second limit. This is an unresolved local verification limitation; no new full browser pass is claimed. Earlier browser checks remain recorded in the implementation log.
- GitHub Actions builds the frontend and runs backend/ML contracts without production credentials. Both jobs passed in the [first submission run](https://github.com/jjpaz/numa/actions/runs/43660850177), with 116 tests passed and 3 skipped on Linux/Python 3.11. See [workflow runs](https://github.com/jjpaz/numa/actions/workflows/ci.yml) for later revisions.
- The earlier public browser verification created a fictional named profile, planted an entry, observed its name and saved count from an existing psychologist session, and reopened the persisted entry after normalized name login. Clinical responses excluded private text. The temporary verification entry was removed.
- Real DAM/VAD execution records are historical. They were not repeated or enabled in the application for submission preparation.

## Source and deployment relationship

The mailbox and connected backend were merged through [PR #2](https://github.com/jjpaz/numa/pull/2), followed by isolated ML recovery through [PR #3](https://github.com/jjpaz/numa/pull/3). The submission update adds the subsequently deployed named-profile, polling and branding fixes to source control, alongside the revised README, current documentation and CI.

Deployment and GitHub history are tracked separately. A source merge is not evidence of a new Vercel or Modal deployment; documentation and CI changes do not alter the already deployed runtime.

## Remaining scope

- Record and edit the short demo video, then add its published link to the README.
- Continue real-device QA and print-layout checks. Safari recording UI was previously reported working; VAD/DAM on a real Safari recording is still unverified.
- Any future DAM/VAD diary integration needs its own contract, stored versioned results and audio evaluation. This remains separate from the submitted demo.
- Saved recordings cannot be replayed after reload because raw audio is not retained. Processing queues are in memory and can be interrupted by a process restart.

Numa is a fictional-data research prototype, without clinical validation. Open name access is for the presentation; private account authentication is not implemented.
