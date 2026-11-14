# Event resources and rationale

Source: Junction platform entries extracted locally on 13 November 2026. Event pages require a logged-in participant; offers have not been independently revalidated or redeemed in this implementation.

| Selected service | Offer | Purpose | Published tech-challenge prize |
|---|---|---|---|
| Gemini API | Event credits by application, up to 400 teams; amount unspecified; 18+ | Audio transcription and private journal understanding | €4,000 / €2,000 / €1,000; first also $1,000 Google Cloud credits per member |
| Aiven | $50 signup credits | The sole PostgreSQL datastore | €1,000 / €750 / €500 |
| Modal | $100 per participant; one year from redemption | Python API and SpeechBrain inference | $2,000 cash plus $3,000 Modal credits |
| Codex | 2,500 usage credits valued at $100 per participant; 30 days after redemption | Implementation, review and verification | $10,000 / $5,000 / $2,500 in API credits |
| SpeechBrain | Downloadable pretrained model; card declares Apache 2.0 | Experimental vocal-expression estimates | No separate event challenge |

Codex event credits do **not** include API credits or a paid subscription. Prizes are potential awards, not free usage balances. No probability of winning or guaranteed combination of prizes is asserted.

## Activation

- Gemini: [event credit form](https://forms.gle/bByXvjGkW9WZuYwW9), one submission per team; create the API key in the issued account. Confirm the selected audio-capable model with the smoke test.
- Aiven: [signup](https://console.aiven.io/signup). Create PostgreSQL only, obtain the TLS service URI and CA requirements.
- Modal: [event redemption form](https://modal.fillout.com/t/qMXCmRGseUus?code=VVX-2QX-8HW), published code `VVX-2QX-8HW`; authenticate CLI and create the `numa-secrets` secret.
- Codex: use the participant-specific redemption link in [Junction hackerpacks](https://hackjunction.app/participate/45/hackerpacks). Never publish that personal link.
- SpeechBrain: [model card](https://huggingface.co/speechbrain/emotion-recognition-wav2vec2-IEMOCAP). Retain attribution and document the model revision and limitations. The published dataset accuracy does not establish accuracy for this product or depression recovery.

## Other available offers, not part of this architecture

Verda publishes €200 compute/inference credits; Featherless $50 API credits; Claude $20 API credits per participant; Context.dev 50,000 API credits per team without expiry; Exa $50 per participant. CRACI offers event compute/build credits. These are alternatives or unrelated capabilities, not extra dependencies. Exact terms are in the local event resource files.

MongoDB Atlas and Tiger Data are not selected because Aiven already serves persistence and SQL analytics. Verda duplicates Modal's compute role. ElevenLabs adds a voice-output service to a product that currently responds in text. No extra service is included purely to claim participation.

## Submission

Main challenge: **Beyond the Clinic — Aalto University**. Tech challenges: **Best Use of Gemini API**, **Best Use of Aiven**, **Best use of Modal**, **Best Use of Codex**, only after the corresponding live contribution is demonstrable. [Modal challenge](https://hackjunction.app/participate/45/tech-challenges/40), [Aiven challenge](https://hackjunction.app/participate/45/tech-challenges/43), [Gemini challenge](https://hackjunction.app/participate/45/tech-challenges/48), [Codex challenge](https://hackjunction.app/participate/45/tech-challenges/49).

The submission needs accessible source and a pitch video of at most two minutes under the saved event guide. Event rules restrict code written before the event. This project was implemented in a new directory; any use of prior references still needs organizer clarification. Team members must activate their own accounts; no account, deployment or submission has been made by this implementation.
