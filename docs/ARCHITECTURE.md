# Architecture and data boundaries

The React app talks only to the FastAPI backend. The backend authenticates a signed eight-hour bearer session, looks up the server-owned role, checks ownership or assignment, and accesses a single PostgreSQL database. Zustand, a second database and a second LLM provider are not used. Browser sessionStorage contains only the session token; journal content is not persisted there.

## Entry pipeline

`record → POST audio + request_id → pending → processing → completed / failed → review/edit → saved`

FastAPI holds the recording temporarily in memory (10 MB request cap). FFmpeg normalizes supported browser audio to mono 16 kHz PCM with a 120-second processing limit. The public runtime runs acoustic measurements on one branch and Gemini transcription followed by text-only journal understanding on the other. Vocal ML is disabled. A legacy optional SpeechBrain adapter exists in the code; DAM and Silero VAD remain separate experiments. The semantic call never receives vocal model output. Exact evidence substrings are validated before retaining an explicit feeling. Pending drafts do not contribute to trends or recommendations.

An entry can be saved after partial failure. Repeated request IDs reuse the same entry. Failed recordings can be retried with the original request ID. Saved transcripts can be corrected; semantic analysis is recalculated without modifying voice measurements. If the semantic provider is down, manual words can still be saved with empty explicit mentions and a visible failure message.

Raw audio is not stored in PostgreSQL, a bucket, or a Modal Volume. Only the isolated ML experiments use an artifact-only Volume for model weights; the public API has no model Volume. Clients may replay their current in-memory recording. Reloading does not recover audio; the saved transcript and summary remain available in connected mode.

## Authorization

- Patient GET/PATCH/DELETE paths check both role and entry ownership.
- Psychologist endpoints check assignment before returning a clinical projection.
- Projection contains counts, quantitative voice trends, simulated context, aggregate activity feedback and professional notes.
- Projection excludes transcript, summary, tags, explicit declarations, raw category predictions and audio.
- The synthetic sample account cannot create new entries. The fresh account has no synthetic observations.
- Password-based demo identities remain available through the API and local preview; the public UI uses explicitly enabled name access. No private account registration flow is provided.
- Optional name-only presentation access creates a persistent patient per Unicode-normalized, case-insensitive name and assigns it to the shared demo psychologist. Different names have different entry owners; anyone using the same name can reopen that demo profile. Sample and psychologist names remain greeting aliases. Legacy shared entries stay under Alex Morgan, and legacy named patient sessions must sign in again. This mode is for fictional demonstrations, not private account authentication.

## Baseline and recommendation heuristics

One valid saved entry per UTC calendar day represents that day. The first five distinct days define a frozen provisional baseline. For energy and pause ratio, centre is the median; spread is `max(1.4826 × MAD, floor)`. Floors are 0.01 for RMS energy and 0.06 for pause ratio. A later day is outside range if either absolute standardized difference exceeds 3. Three consecutive later days outside range produce a review flag. These deliberately transparent demo thresholds have no clinical calibration. Follow-up recordings never train this baseline.

The voice schema supports model probabilities with an identifier and snapshot revision, but the live demo does not produce them: ML is disabled and the probability map is empty. Current trends use interpretable acoustic features. Seeded fictional observations and isolated model experiments are distinct from measurements made on a new journal entry.

Recommendations are restricted to the patient's preferred activity catalogue. Rank by `(helpful + 1)/(responses + 2)`, using comparable simulated sleep context when observations exist, otherwise all available feedback. The evidence count and deterministic rationale are exposed. The current recommendation endpoint does not call Gemini to rephrase its explanation. Neither reported helpfulness nor a subsequent voice change proves efficacy.

## Routes

### Patient-led growth

`GET/PATCH /api/patient/growth` keeps presentation preferences in the patient's existing PostgreSQL user record. Existing accounts default to no optional modules. Patients choose modules under My garden → Your space. The simple-mode control has been removed from the interface; its API field remains for compatibility. A local preview uses the same API and ephemeral repository. No additional database, external service or mood classifier is involved in disclosure decisions.

Invitations use at least three activity-feedback observations, or sufficient baseline history for a voice-view invitation. Only one appears at a time. Dismissal is remembered; other invitations are snoozed for that UTC day. Modules are always available by choice in `/patient/garden#your-space`, regardless of vocal estimates or wellbeing. The illustration's remembered page count is a high-water mark and does not shrink after inactivity or page deletion. No streak, level or wellbeing reward is displayed.

Optional habits store one chosen intention and completion dates without a streak. `GET/POST/PATCH /api/patient/experiments` stores private questions, an activity choice, active/paused/completed state and a final reflection in the same repository. Activity feedback since experiment creation is observational and explicitly includes paused periods. These questions and reflections are excluded from clinical projections. The sample's journal remains read only; its presentation preferences can be explored.

Both disclosure and preference changes are patient-only, with ownership checked by the backend. In-process read/modify/write locks and frontend request versioning prevent polling from undoing a newer presentation choice.

Frontend: `/`, `/login/patient`, `/login/psychologist`, `/patient` (mailbox), `/patient/journal`, `/patient/garden`, `/patient/entries/:id`, `/clinic`, `/clinic/patients/:id`, `/clinic/patients/:id/report`. Legacy `/patient/new`, `/patient/insights`, `/patient/connections` and `/patient/space` URLs redirect to Home or the corresponding garden section.

API: `/api/health`, `/api/auth/login`, `/api/auth/demo`, `/api/auth/me`, `/api/patient/preferences`, `/api/patient/growth`, `/api/patient/experiments`, `/api/patient/experiments/{id}`, `/api/patient/entries`, `/api/patient/entries/text`, `/api/patient/entries/audio`, `/api/patient/entries/{id}`, `/api/patient/entries/{id}/action`, `/api/patient/entries/{id}/follow-up`, `/api/patient/insights`, `/api/patient/recommendation`, `/api/clinic/patients`, `/api/clinic/patients/{id}`, `/api/clinic/patients/{id}/notes`.

## Persistence and operational limits

`numa_records` has a `(collection, id)` primary key, an owner index and JSON payloads for users, entries, notes and seed metadata. SQLAlchemy uses PostgreSQL upserts; startup creates the initial table if needed. The process-local RLock coordinates read-modify-write operations in the demo instance. Modal is capped to one container. This is not a distributed job queue: a process restart during analysis can interrupt work; the entry remains recoverable through re-recording/retry. A durable queue and normalized schema migrations are future work, not claimed as implemented.

Visible tabs refresh automatically, waiting five seconds after each request finishes before polling again. Slow responses are allowed to render rather than being superseded by overlapping timer requests. A clinic load failure displays an error and can recover on the next poll. Production startup refuses missing database, Gemini credentials, session secret or account passwords. Public deployment uses HTTPS, an exact CORS origin allowlist and a TLS PostgreSQL URI. Gemini and Modal usage stays subject to account quotas and billing. See [DEPLOYMENT.md](DEPLOYMENT.md) for the published endpoints and deployment procedure.
