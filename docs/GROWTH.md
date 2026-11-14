# A space that grows with you

## Patient experience

The journal starts with a single invitation to record or write and up to three previous pages. There is no metrics grid, wellbeing level, compulsory mood question, locked feature or streak. The patient can always open all previous pages.

An optional discovery card appears when there are at least three feedback observations for an activity, or a provisional voice baseline is ready. It invites exploration rather than declaring progress. Choosing it adds the relevant module; choosing **Not now** remembers the dismissal and suppresses other invitations that day.

**Your space** allows the patient to add or remove rest, movement, music, one small intention, personal patterns and voice observations at any point. Enough data is required for a meaningful chart, but not for permission to explore its view. All existing accounts default to no optional modules; their data remains intact. The fictional sample can demonstrate presentation choices without accepting new journal entries into its synthetic baseline.

**Today, something simple** hides optional panels and discoveries without changing modules, habits, experiments or journal entries. **Back to my space** restores that arrangement. These preferences are saved to the same user record, not a separate database or a clinician setting. No vocal estimate, inferred mood, review flag or professional judgment grants or revokes interface features.

## Growth without penalties

The illustration remembers the highest number of saved pages observed (sprout, leaves, bloom). It does not shrink during absence, after a difficult entry or when the patient chooses simple view. No level, threshold, score or countdown is shown. This is a visual memory of getting acquainted, not a representation of mental health.

The patient can choose one small habit and optionally note making room for it today. Dates are recorded without a streak. Personal experiments store a private question, an activity, pause/resume state and an optional closing reflection. Reported helpfulness since creation is observational, includes paused periods and does not establish causality. Experiments can be put away without losing their records.

## Palette and style

| Token | Colour | Role |
|---|---|---|
| Ivory | `#F5E6C5` | Warm page background |
| Apricot | `#D78B30` | Primary action, flower and selected accents |
| Natural | `#9F886F` | Botanical elements, muted decorative surfaces |
| Organic | `#3F422E` | Text, outlines and strong surfaces |

Small text uses darker derived ink rather than Natural on Ivory. Journal headings use a serif, with paper edges, quieter previous-page rows and an original botanical illustration. The clinical portal shares the colours while retaining its professional information hierarchy.

## Verification

Backend checks cover initial disclosure, persistence across sessions, simple-mode restoration, evidence-backed invitations, remembered dismissals, non-regressing illustration, optional habits, experiment privacy and role boundaries. Browser checks exercise the full journey, module choice, reload, restoring simple view, showing all pages, habit completion and experiment pause/reflection.

Browser tests run on isolated ports 5174/8001 and leave the user's preview and its data on 5173/8000 untouched. A private local snapshot was taken before restarting the preview API and restored; backups remain under ignored `.local/`. Connected mode continues to use PostgreSQL alone.
