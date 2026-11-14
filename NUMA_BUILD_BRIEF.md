# Numa — implementation brief

## Product contract

Numa is an independent voice journal for everyday support after depression treatment. English UI; warm paper-and-sage design; free voice notes; text summaries; patient and psychologist portals. New source lives in this project and does not copy code or brand assets from an earlier MVP.

The central interaction never requires a mood score or a direct declaration of how someone feels. There are two separate inputs: experimental vocal model/acoustic signals, and explicit feelings spontaneously expressed in the journal. Missing explicit information stays missing; contradictions are not deception and vocal estimates do not override the person's words.

## Patient experience

### Progressive experience and palette (implemented revision)

Start with a quiet journal invitation and up to three previous pages. Hide optional context and charts by default. Offer one evidence-backed discovery invitation at a time; let the patient explore or dismiss it. In `/patient/space`, allow explicit opt-in to sleep, movement, music, one small intention, patterns and voice observations. A further voluntary section supports personal experiments with pause/resume and reflection. These capabilities never require a positive mood estimate or a clinician's approval.

Provide **Today, something simple**, preserving all selected modules and history while hiding extra panels. Return restores those choices. The plant remembers shared pages, without shrinking during absences or reflecting clinical status. Avoid streak loss, locked features or automatic expansion based on mental state.

Apply Ivory `#F5E6C5`, Apricot `#D78B30`, Natural `#9F886F` and Organic `#3F422E` across both portals. Use warm paper surfaces, serif journal headings, a restrained botanical motif and legible dark text; Natural is decorative rather than a low-contrast body-text colour.

Create a voice note with live waveform, stop/replay/re-record controls and a two-minute cap. A written alternative handles microphone failure or preference. Review and edit private transcript and summary before saving. A timeline holds saved entries; optional modules show actions, feedback and clearly simulated daily context. Discover useful associations with observation counts when the patient chooses to explore them. No missed-day penalties or compulsory streaks.

Action catalogue: short walk, user-chosen music, comfortable breathing and contacting a trusted person. After trying an action, optionally select Helpful / Not helpful / Skip or add a separate voice comparison. Acoustic difference and reported helpfulness remain separate. Preferences restrict which actions are suggested.

Apple Health, Last.fm, calendar and wearable services are visible only as unconnected future possibilities. Weather, activity, sleep, outdoor time and listening duration are simulated. Every source is labelled.

## Psychologist experience

Assigned patient overview, private-entry counts, personal voice trends, observation coverage, persistent-change prompt, simulated quantitative context, aggregate shared action feedback and professional notes. Printable one-page observation report. Audio, transcript, summary, explicit statements and journal tags are excluded server-side from clinical responses. A new patient receives no fictional baseline.

## Architecture and resource selection

React + TypeScript + Vite + React Router + CSS + Motion for frontend. FastAPI in Modal for backend and ML. Aiven PostgreSQL is the only persistent datastore. Gemini handles transcription, text-only interpretation and factual recommendation explanations. SpeechBrain's English wav2vec2 IEMOCAP pretrained classifier runs in Modal. Codex supports development and verification. See `docs/RESOURCES.md` for all selected credits, activation links, prizes and unused alternatives.

Selected published offers: Gemini event credits (application, amount unspecified); Aiven $50; Modal $100 per participant for a year; Codex credits valued at $100 per participant for 30 days, excluding API credit. Published prizes: Gemini €4,000/€2,000/€1,000, Aiven €1,000/€750/€500, Modal $2,000 cash + $3,000 credits, Codex $10,000/$5,000/$2,500 API credits. Offers and account activation require verification. Do not duplicate databases, compute clouds or LLM providers for prizes.

## Analysis and data rules

- Entry jobs have pending, processing, completed and failed states. Stable client request IDs prevent duplicate entries on retries. Partial analysis failure must not block saving private words.
- Normalize audio to mono 16 kHz. Reject insufficient, very quiet or heavily clipped audio for vocal conclusions. Retain model identifier/revision, probability distribution, quality, duration, energy and pauses. Never call a category a probability of depression.
- Semantic extraction receives only text, never acoustic model outputs; retain feeling labels only with exact textual evidence. Transcript edits recalculate semantics without changing audio measurements.
- Baseline starts after five valid saved entries on distinct UTC days. Use median/MAD with explicit floors and a three-sigma observation heuristic. Three consecutive later outliers prompt review. These thresholds are demonstrative, not clinically validated.
- Follow-up recordings do not train baseline. A fictional sample profile is distinct from the fresh live profile.
- Rank the preferred activity catalogue using reported helpfulness in comparable sleep context where available, otherwise all feedback with small-sample smoothing. Reveal evidence counts and observational limits.
- Raw audio is temporary in memory, not permanently retained by this application. Inform users about processing by configured external services. Private words persist only in PostgreSQL in connected mode.
- Signed sessions and role/ownership/assignment checks are verified in the backend. Demo identities only; no public registration or real patient information.

## Acceptance and handoff

Run frontend production build, backend tests and desktop/mobile browser tests. Test permissions at API level, separate vocal/self-report results, absent explicit feelings, distinct-day baseline, sample/live isolation, idempotency, saving after provider failure, feedback, follow-up audio and cross-session visibility. Clinical refresh interval is five seconds.

Deliver setup instructions, environment variable templates, deployment definitions, cloud connectivity smoke checks, architecture, honest verification log and a two-minute demo script. Cloud model inference, PostgreSQL connectivity, account canjes and public deployment must remain listed as unverified until they actually run with team credentials. Do not claim clinical efficacy or invent integration results.
