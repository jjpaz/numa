# Numa design system

The reference for every screen that gets redesigned. Tokens live in
[`src/design/tokens.css`](src/design/tokens.css) with the `--n-` prefix so they
never clash with older variables (`--paper`, `--muted`, …). The public home page
([`src/landing.tsx`](src/landing.tsx), [`src/landing.css`](src/landing.css)) is
the first screen built on it.

## Central principle

**The voice becomes a plant. One protagonist per screen.**

Numa listens to a minute of someone's day and, over time, notices what helps.
The visual language says the same thing: a voice trace with real bursts and
pauses turns into a stem, leaves and a flower. Each screen has exactly one
memorable element; everything around it stays quiet and disciplined.

## Colour

| Token            | Value     | Role                                                                                                                        |
| ---------------- | --------- | --------------------------------------------------------------------------------------------------------------------------- |
| `--n-paper`      | `#F8F0DF` | Page background                                                                                                             |
| `--n-ivory`      | `#F5E6C5` | Paper sheets, halos, text on the dark earth surface                                                                         |
| `--n-moss`       | `#3F422E` | Main ink; the dark "earth" surface                                                                                          |
| `--n-moss-deep`  | `#2E3122` | Strong ink: headings, primary text, button text                                                                             |
| `--n-ink-soft`   | `#5F5643` | Secondary text (6.4:1 on paper, 5.9:1 on ivory)                                                                             |
| `--n-apricot`    | `#D78B30` | **Only** the flower (today's, in the patient garden), the primary action and the tip of a live recording                    |
| `--n-attention`  | `#9A5B13` | Clinic only, and only the "review" state (status text, 3px rules, points outside a range). 4.8:1 on paper                   |
| `--n-danger`     | `#9A3B26` | Only the confirm button of a destructive action, with ivory text (5.6:1). Never decoration                                  |
| `--n-past-bloom` | `#D9B98A` | "Past bloom": flowers of earlier days, with an ivory centre. Desaturated so today stays the only apricot flower. Never text |
| `--n-natural`    | `#9F886F` | Decorative only (leaves, underlines, rules). Never text                                                                     |
| `--n-sage`       | `#A3AC84` | Leaves. Never text                                                                                                          |
| `--n-focus`      | `#8A5A22` | Focus ring: 2px outline, 3px offset                                                                                         |

All text meets WCAG AA. Ivory at 75% opacity on moss (5.5:1) is the lowest
contrast allowed for small text on the earth surface.

## Type

| Token              | Value                                    | Use                       |
| ------------------ | ---------------------------------------- | ------------------------- |
| `--n-font-display` | Young Serif, weight 400 only             | Headings and quoted words |
| `--n-font-ui`      | Hanken Grotesk Variable, 400 / 500 / 600 | Text and interface        |

Both fonts are self-hosted through `@fontsource` packages, so nothing depends on
Google Fonts or a CDN.

- Scale (px): **14 · 16 · 18 · 21 · 28 · 36 · 48 · 72 · 96** (`--n-text-*`).
- Line height: 1.55 for text, 1.02–1.08 for large headings.
- Display letter-spacing: −0.02em.
- Minimum size: 14px. Dates use tabular figures.

## Shape

Radius follows hierarchy; it is never one value for everything.

| Token               | Value | Use                    |
| ------------------- | ----- | ---------------------- |
| `--n-radius-sheet`  | 6px   | Paper sheets           |
| `--n-radius-field`  | 12px  | Inputs and fields      |
| `--n-radius-pebble` | 999px | Buttons (pebble shape) |

## Lines and paper

| Token              | Value                           | Use                                              |
| ------------------ | ------------------------------- | ------------------------------------------------ |
| `--n-stroke`       | 1.75px                          | The voice line and the stem, at every width      |
| `--n-sheet-border` | `rgb(46 49 34 / .12)`           | 1px border on paper sheets                       |
| `--n-sheet-shadow` | `0 1px 0 …, 0 8px 20px -14px …` | The only shadow a sheet may have: short and warm |

Paper sheets sit top-aligned in their row. Growth is told by their content (the
sprout → leaves → flower glyphs, ~40px tall), not by offsets or rotation. A
generic grey drop shadow is never allowed.

## The voice line

- It is drawn in CSS pixels (1 SVG unit = 1px) from the **measured** baseline of
  the headline, so the last line of the headline rests 12–16px above the wave's
  axis at every width. Margins are never tuned by eye.
- It is a smooth spline (Catmull-Rom converted to cubic béziers) with no sharp
  angles. Each burst has a Gaussian envelope, each half cycle gets its own
  amplitude, and the frequency drifts slightly. Pauses keep only a
  micro-undulation. It must read as a voice, never as a clinical monitor.
- The peak amplitude is ±28px at 1440px, scaled to the width. Directly under the
  words, crests are softly limited so they never touch the letters.
- The shape comes from a seeded PRNG (mulberry32), so it is the same on every
  load.
- The stem is born from the wave in one wide, continuous curve. The flower sits
  at the height of the first headline line, at least 64px from the right edge on
  desktop. On screens ≤720px the plant is at least 140px tall and never covers
  text.

### Shared module: `src/design/voiceLine.ts`

Every voice line is drawn with the same pure helpers, so the public page and the
patient's garden are the same line:

| Export                                         | What it does                                                                                                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mulberry32(seed)`                             | Seeded PRNG                                                                                                                                             |
| `hashString(text)`                             | Stable 32-bit hash (FNV-1a), e.g. from an entry id                                                                                                      |
| `voiceWave(options)`                           | Points of a smooth waveform: drifting carrier, a fresh amplitude per half cycle, any envelope, and an optional `limitLift` to keep crests clear of text |
| `gaussianEnvelope(bursts, at)`                 | Sum of Gaussian bursts, capped at 1                                                                                                                     |
| `catmullRom(points)`                           | Points to cubic béziers, with no corners                                                                                                                |
| `cubicAt`, `sampleCubic`, `lengthOf`, `cubicD` | Curves for stems, and lengths for the drawing animation                                                                                                 |

## Patient garden (`/patient`)

The patient's home continues the public page: **your garden grows from your own
voice.**

- **One line, recent days.** A single voice line across the content width (max
  1280px) shows the **last 14 days**: two weeks ago on the left, today on the
  right. On screens ≤720px it shows the **last 7 days**. The only labels are
  "Two weeks ago" (or "This week") and "Today", at 14px in ink-soft. There are
  no other date marks.
- **Today's plant is the protagonist.** As on the public page, the line ends in
  a wide curve and rises as today's stem: about 170–195px tall at 1440 (150px on
  small screens), with leaves along the stem.
  - `done`: the full plant with today's six-petal **apricot** flower. Apart from
    the button, this is the only apricot in the garden.
  - `in_progress`: the same plant, shorter, with only its stem and two leaves
    and no flower.
  - `pending`: the line ends in the curve with a seed at its tip. There is no
    stem.

  For a new person, the first entry should feel like a reward: one tall
  flowering plant, not a small sprout at the edge.

- **Earlier days are secondary.** Each day with a saved entry is a soft burst
  (Gaussian envelope, 35–70% of the day's width, ±16–22px at 1440), and that
  entry's small plant (50–120px) grows from the centre of its burst. Flowers of
  earlier days use `--n-past-bloom`, never apricot.
- **Deterministic variation, never measurements.** Every variation comes only
  from a hash of the entry id:
  - height by `kind` ±15%;
  - tilt from −5° to +5°;
  - an offset of ±30% within the day's slot;
  - leaf size ±15%;
  - each burst's width and weight.

  Several entries on one day gather with a slight overlap. Duration, energy,
  pauses and any acoustic or mood data are never used: a plant remembers that
  there was a page, it does not measure how the person is.

- **Nothing withers.** Days without an entry are near-flat pauses. Plants never
  shrink, fade or disappear for absences.
- **The drawing is as tall as what grows in it.** The SVG height follows its
  tallest plant, so with 0–2 entries the greeting, the garden and the action
  read as one compact block. There is no empty sky over a flat line.
- **Today is one group**, right-aligned under the end of the line: "Today"
  (14px ink-soft), 8px, the state sentence (icon plus words, never colour
  alone), 12px, the button, then "Add another entry". On screens ≤720px,
  "This week" and "Today" share a row and the action is left-aligned and full
  width below it.
- **Below the line**, a moss "earth" band holds two columns:
  - The latest entry on an ivory sheet, about 55% of the row. It starts with a
    16px line ("Today's entry" or "Your latest entry", then the date in tabular
    figures). Its self-care reflection is the sheet's only `h2`, in Young Serif
    28px.
  - Beside it, top-aligned with the sheet, "How your garden is growing" in
    words, never a streak counter.
- **Simple mode** keeps only the greeting, the garden and today's action.
- **Motion:** the line draws left to right (~1.5s), and each earlier plant rises
  from its base as the trace passes its day. Today's leaves unfold after the
  stem is drawn, and today's flower opens last. This happens once per browser
  session (`numa-garden-grown` in sessionStorage); after that, and with reduced
  motion, the final state is shown directly. There is no page-level fade: text
  is visible from the first frame on every page.

## Entry page (`/patient/entries/:id`)

"A page of your journal". It uses the same 1280px column as `/` and `/patient`.

- **Header.**
  - The long date in 16px ink-soft, the title as the only `h1` (Young Serif,
    `clamp(40px, 5vw, 64px)`) and the entry's self-care reflection under it.
  - Beside them (above them on small screens) is **the same plant this entry
    has in the garden**: drawn by `EntryPlant`, which uses the garden's own
    `pastPlantShape` (same kind, height, tilt, leaves and sway from the entry
    id), growing from its own short burst of voice line.
  - Flowers: today's saved entry flowers in apricot; earlier days use
    `--n-past-bloom`; a draft is a young plant with no flower.
  - When feedback turns an earlier plant into a flower, the flower opens once
    as a direct response. The text never promises this.
  - A 1px `--n-sheet-border` rule closes the header.
- **The words on a sheet, never in a form.**
  - **Reading mode** (saved): the transcript as text in Young Serif 24–28px
    (21px when long, and on small screens), line height 1.5, max 60ch. Under it
    come "In short" and the summary in Hanken 18px.
  - **Writing mode** (a fresh draft, or after "Edit words"): the same blocks
    become borderless textareas in the same type and place. They have a
    transparent background, a 1px bottom line, a visible focus ring and grow to
    fit. The first field keeps the accessible name "Transcript".
  - **Saving is a state, not a dead button:**
    - draft: "Save this page" plus "Discard draft";
    - saved: "✓ Saved in your journal" plus "Edit words";
    - editing: "Save changes" (only once something changed) plus "Cancel".
  - The fictional sample is always read only.
  - Tags are plain 14px text, never pills.
- **What Numa noticed** sits beside the sheet, with no box, always visible.
  - "From your voice" and "In your own words" are two separate perspectives.
    Each states its source in words ("Measured acoustics. ML not active.").
  - Model categories live in a closed `<details>`, together with the reminder
    that they are not feelings.
  - It closes with: "A voice estimate never overrides your experience."
  - Simulated context is a plain list labelled "Simulated".
  - In simple mode the whole column folds into one closed `<details>`, but its
    content stays in the DOM.
- **A small next step** lives in the moss "earth" band (ivory on moss), only for
  saved, non-sample entries.
  - The title is in Young Serif 36px; the reason is in ivory at 75%.
  - "I tried this" is the apricot pebble. The feedback choices are ivory-bordered
    pebbles; the chosen one fills with ivory and has `aria-pressed`, and a check.
  - The breathing guide only moves while it is open.
  - The voice-comparison recorder sits directly on the band in its dark tone
    (`tone="dark"`: ivory line, text and record pebble; see "Recording").
- **Footer.** The privacy sentence (said once, here) and a quiet "Delete entry"
  or "Discard draft" link. Deleting is confirmed inline: "Delete this entry?
  This can't be undone." with a `--n-danger` "Delete" and "Keep it". There is
  never a modal.
- **Processing.** The title "Listening to your day…" and one sentence. The voice
  line draws once and a dot breathes at its end while the entry is read. With
  reduced motion it is still.

## Journal (`/patient/journal`)

Every entry the person has planted, newest first, on the same 1280px column.
Styled in [`src/journal.css`](src/journal.css).

- **Header.** "My garden" as a quiet underlined link, then the only `h1`,
  "Journal" (Young Serif, `clamp(40px, 5vw, 64px)`), and one 18px ink-soft line.
- **The week is the home's garden, compact.** `VoiceGarden` with `days={7}` and
  `compact`: the same voice line and plants, about 110px tall, with no growth
  animation, no today action and no state text. Only "This week" and "Today"
  (14px ink-soft) sit under it. Its `aria-label` says how many of the last 7
  days have an entry.
- **Months** are `h2`s in Young Serif 28px with 48px of air above and a 1px
  `--n-sheet-border` rule under them.
- **Rows, never cards.** Each entry is one link across the whole row, separated
  by 1px `--n-sheet-border` lines: no background, no radius, no shadow, no
  arrow.
  - Three columns: the date (~112px, 16px tabular; "Today" in 600 moss-deep,
    never apricot), 16px of air, the entry's plant (56px), then the content
    (max 64ch). The date's baseline sits on the plant's base; the content
    starts at the top of the row.
  - Hierarchy, strongest first: the title in Young Serif 28px; the reflection
    in Hanken 18px ink-soft; then the first line of the person's own words,
    without quotation marks, in Hanken 16px ink-soft (line height 1.5), cut to
    one line with an ellipsis (two on small screens, and left out when there are
    no words). Last, a 14px 600 moss meta line: "Something helped" (with a 14px
    sprout), "Draft, not saved yet" or "Still listening".
  - Hover tints the row with `--n-ivory` at 50%, with no animation. Keyboard
    focus (`:focus-visible`) is a 2px `--n-focus` outline at −2px around the
    whole row, with a 6px radius.
  - 28–32px of vertical padding per row.
- **The plant per entry** is `EntryPlant` from the entry page, as a decorative
  56px glyph (`glyph`, `decorative`): the same kind and the same deterministic
  variation as in the garden. The glyph measures its own plant (`getBBox`) and
  sets its viewBox so the plant fills the box from its base (6px above the
  bottom) to 4px below the top. The flower is apricot only for today's saved
  entries. Earlier ones use past bloom, deepened in the rows only to `#C4A06B`
  so it still reads at 56px (still a muted tan, never apricot). A draft is a young sprout with
  a dotted stem. While an entry is being read, its title is "Listening to your
  day…".
- **Empty.** No box: "Your journal is waiting for its first entry." (18px), then
  the apricot pebble "Add an entry" (no icon). The fictional sample shows only
  the sentence.
- **≤720px.** The 44px plant on the left with the date (14px) on its base line;
  under the date, the title (24px), reflection (16px), words (15px, two lines)
  and meta.

## Secondary screens

My garden, Your space, What helps, Connections, Login and the 404 page are not
redesigned creatively: they speak the vocabulary of the screens above. Styled in
[`src/secondary.css`](src/secondary.css) (after `journal.css`, before
`clinic.css`).

- **Common frame.** Left-aligned on the 1280px column, one Young Serif `h1`
  (`clamp(40px,5vw,64px)`) in a single colour, an 18px ink-soft subtitle, and a
  16px underlined back link with no arrow. Sections are Young Serif 28px
  headings, often over a 1px rule with a 14px note on the right ("Simulated
  data"). No eyebrows, badges, pills, icons in buttons, "·" between metadata or
  card grids. Secondary actions are outlined pebbles (`aria-pressed` fills them
  with moss); text actions are underlined links. Fields have a 12px radius, a 1px
  border and a `--n-focus` ring; checkboxes are the system's 22px box.
- **My garden: the wide garden, by month.** The home's voice line and plants,
  one plant per saved entry placed on its day, across the full width (about
  300px tall). Each month is its own line (newest first, its name in 14px), so a
  long history is never squeezed. Today's flower is apricot, earlier flowers past
  bloom. It is static: nothing depends on an animation to be seen. With no
  entries it is a quiet line ending in a seed. "Over time" draws eight weeks as
  stems with the system's stroke and leaves (one per entry) over a 1px ground
  line, never a filled band. Recent entries reuse the Journal's rows. An
  invitation is text beside a 3px moss rule.
- **Your space: switches that say their state.** Six rows with 1px lines: the
  module in Young Serif 21px, its description in 16px (max 60ch) and, where it
  applies, "Simulated context in this prototype". On the right a real switch
  (`role="switch"`, `aria-checked`, named by the module's heading) with its state
  in words, "In your space" / "Not added". The state is never colour alone.
- **What helps** lists activity feedback as rows with a thin bar (as in the
  clinic) and keeps each pattern's own "personal association, not proof of
  cause". Voice over time reuses the clinic's observation chart with
  `audience="patient"`: "your usual range", "your first days", out-of-range days
  marked by a ring in moss-deep. `--n-attention` stays clinic-only.
- **Connections** shows today's simulated context as the same definition list
  (value in Young Serif 28, label 14px) and future integrations as rows: "Not
  connected, a future integration".
- **Login in two zones.** Left (~45%): wordmark, back link, `h1`, sentence and
  form. Right: one calm, static motif: a stretch of voice line ending in a seed
  (new journal) or a flowering plant (sample); for the psychologist a plain moss
  field with "Trends only. Journal entries stay private." in Young Serif 28
  ivory. One column at ≤900px. A session for another account is a sentence
  beside a 3px moss rule; errors are an icon and words in `--n-danger`.
- **One form, two kinds of demo access.** When the backend enables name-only
  access (`demo_name_login`, the public demo), the form asks only "Your name";
  otherwise it asks for the published demo email and password. Both share the
  same field style, the same apricot button, the same error line and the same
  return to the page the person was heading for. While the backend is still
  being reached, a quiet sentence says "Connecting to your space…".
- **404** is an `h1`, one sentence and an underlined link home (or back to the
  person's own portal).

## Clinic (`/clinic`, `/clinic/patients/:id`, `…/report`)

The psychologist's portal is a professional tool. It shares the tokens, type
and tone of the patient's space, but has its own identity: **no garden, no
plants, no decorative voice line, no earth band**. Sober, dense and legible;
data always in tabular figures. One protagonist per screen: the table of people
on the dashboard, the observation chart on a person's page. Styled in
[`src/clinic.css`](src/clinic.css) (imported last); charts in
[`src/clinicCharts.tsx`](src/clinicCharts.tsx).

- **A moss sidebar is the portal's identity.** 240px, fixed, `--n-moss` with
  ivory text (8.4:1): the wordmark, "Overview" (active: ivory at 10% and a 3px
  ivory bar on the left), and at the bottom the boundary note in 14px ivory at
  75% (5.5:1) and the user with a 44px sign-out button. Focus on the moss is a
  2px ivory ring. At ≤900px it becomes a 56px moss top bar (wordmark, Overview,
  sign out).
- **Content** sits on `--n-paper`, max 1200px, padding `clamp(24px,4vw,56px)`.
  A 14px top line holds the route ("Your practice / Patient wellbeing"), the date
  and "Live, updates every 5 seconds" with a static moss dot (never blinking).
  The preview mode is a 14px sentence in the footer.
- **State is words with a symbol, never a pill.** "● Review suggested" (600,
  `--n-attention`), "○ Learning baseline" (ink-soft), "— Within typical range"
  (moss). The symbol and the words carry the meaning; colour only supports it.
- **`--n-attention` `#9A5B13`** (dark ochre) is used **only** for the "review"
  state: its status text, the 3px rule beside a review notice and the
  persistence note, and the points outside a person's range. 4.8:1 on paper;
  never as text on plain ivory (4.4:1). Apricot stays reserved for the one
  primary action ("Save notes").
- **Dashboard.** `h1` "Your patients"; one sentence replaces stat cards ("4
  people in your care. 1 pattern to review. 36 private journal pages, never shown
  here.", numbers in Young Serif 28 from the data). A review is a link row beside
  a 3px `--n-attention` rule, never a coloured box. Filters are 16px text with a
  2px underline on the active one (`aria-pressed`); search is a 12px-radius field
  with a magnifier and an `aria-label`.
- **The table of people** is a semantic `<table>`: 72px rows separated by 1px
  lines, the whole row clickable with a real link on the name (its accessible
  name also carries the state and activities), hover in ivory at 50%, keyboard
  focus as a 2px `--n-focus` outline around the row. Initials sit in a 36px
  moss-outlined circle with no fill. At ≤900px each row stacks: name, state,
  sparkline, last entry.
- **Sparkline** (140×32): the person's recent `trend.points` against their own
  range (an ivory band), a 1.5px moss line, points outside the range in
  `--n-attention`. With no points it says so in words ("No voice entries yet",
  or "Learning, N of 5 days"). Nothing is ever invented.
- **The observation chart** is a person page's protagonist, full width with no
  card, about 280px tall: the "Personal range" ivory band (0–3 robust
  deviations), a "Baseline days" bracket under the first five days, a smooth
  moss line with 6px points, points outside the range in `--n-attention` with a
  ring (shape as well as colour), tabular dates (first, last and every ~5 days)
  and the label "Difference from personal range" instead of a numeric axis.
  Each point has a `<title>`, the SVG's label states the last observation, and a
  visually hidden table holds the same data.
- **Honesty is kept in words:** the heuristic is a prompt for review, not a
  diagnosis (beside a 3px attention rule); the median/MAD note; "Simulated data"
  beside Everyday context; helpfulness and vocal changes never establish
  causality; the observation coverage. Journal text, audio and summaries never
  appear.
- **Everyday context** is a definition list in one row (values in Young Serif
  28, labels 14px). **Actions and feedback** are rows with 1px lines: the
  activity (18px 600), "6 helpful of 6 responses" in tabular figures and a 4px
  bar (ivory track, moss fill).
- **Report.** The same page without the sidebar, notes or controls. Printed: white
  paper, moss-deep ink, the chart in greys that survive any printer (outside
  points solid black with a ring), A4 on one page with 16mm margins, headed
  "Numa, one-page observation report" and the generation date.

## Recording (`/patient/new`, and the voice comparison)

**Your voice draws the line.** The system's voice line is the recording canvas.
It is drawn by `Recorder` in [`src/components.tsx`](src/components.tsx), styled
in [`src/new-entry.css`](src/new-entry.css).

- **The record button is the origin of the line.** The 72px pebble sits at the
  left end, centred on the line's axis, and the line leaves its edge. The state
  text ("Tap to begin" / "Tap to finish" / "Record again", 18px) sits above the
  line, to the right of the pebble, clear of the highest crest. Same on small
  screens.
- **The width is the time.** The line runs from the pebble to exactly the right
  edge of the content (max 1280px), measured with a ResizeObserver and redrawn
  on resize. After a quiet start with the system's micro-undulation (it eases
  in from the pebble), the rest stands for the 2 minutes available: the part
  still free is a dense dotted track in `--n-natural` at 70%, ending in a "2 min"
  label (14px ink-soft) that disappears once the recording is finished.
- **Live, and only real.** While recording, the line grows left to right from
  the microphone's measured loudness: the RMS of the `AnalyserNode` about 10
  times a second, smoothed, with a small noise floor and a soft limit (±28px at
  1440, ±18px on small screens). It is drawn with `voiceWave` + `catmullRom`
  using a fixed carrier and `rand: () => 1`, so the height at every point is the
  measured loudness and nothing else. Pauses are near-flat stretches. A synthetic
  or decorative waveform is never shown as someone's voice.
- **The tip** is a 6px apricot dot that moves with the time: the one exception to
  "apricot only for the flower and the primary action", because it is the moment
  being planted. Beside it (below the line on small screens) is the elapsed time
  in 16px tabular figures. There is no "Listening ·" label.
- **Finished:** the line stays exactly as recorded. It then settles to the axis,
  rises a little and ends in a seed (the same shape as the garden's `pending`
  seed). The dotted remainder disappears.
- **Controls:** the moss record pebble has an ivory icon. Listening back is a
  secondary outlined pebble ("Listen back" / "Pause", `aria-pressed`) with the
  duration; the `<audio>` element stays hidden. There are no permanent animated
  halos.
- **Dark tone** (`tone="dark"`, for the moss band): ivory line, text and pebble
  (moss icon); the seed uses `--n-past-bloom`.
- **Writing instead** replaces the line with a borderless textarea (Young Serif
  24–28px, line height 1.5, max 60ch, 1px bottom line) labelled "Your note".
  On focus the bottom line becomes 2px `--n-focus` and a 2px `--n-focus` frame
  with a 6px radius appears 8px away, so the words never touch an edge and it
  never looks like a form box. Switching modes never loses what was recorded or
  written before it is sent.
- **Consent is short, the full text is one click away.** The system checkbox
  (22px, 1.5px moss edge, 4px radius, a moss check on ivory when ticked, focus
  ring 3px away) with a single 16px sentence; the whole label is clickable. Under it, a closed `<details>` "How audio is handled"
  holds the complete consent text, word for word, in 16px ink-soft (max 70ch).
  The checkbox is described by that text.
- **The one action says why it is waiting.** Until "Make a little sense of
  today" can act it has `aria-disabled`, `cursor: not-allowed` and a softened
  fill: apricot mixed 45% into `--n-paper` (moss-deep text on it is 8:1), never
  opacity. A sentence under it, in an `aria-live="polite"` region linked with
  `aria-describedby`, says what is missing ("Record or write something first." /
  "Tick the box above to continue."). When it becomes available the fill turns
  full apricot in 160ms (instantly with reduced motion).
- **Errors** (no microphone, permission refused, a failed send) are a sentence in
  `--n-danger` with an icon, never colour alone, plus "Write a note instead".
- With reduced motion the live line still follows the voice (it is a direct
  response); there are no decorative transitions.

## Motion

- Easing: `--n-ease: cubic-bezier(.22, 1, .36, 1)`.
- **One orchestrated moment per screen.** On the home page the voice line draws
  left to right (~1.6s), the stem rises (0.6s), the leaves unfold from their
  base 100ms apart, and the flower opens last.
- Text and actions are visible immediately. There are no section fade-ups and
  no animated card hovers.
- `prefers-reduced-motion: reduce` shows the final state directly.

## Layout and accessibility

- Content is left-aligned on a 1280px max width with `clamp(16px, 5vw, 72px)`
  side padding. There is no horizontal scroll at 360px.
- There is exactly one `h1` per page, and tab order follows reading order.
- Focus is always visible (`--n-focus`). State is never conveyed by colour alone.

## Avoid

- Uppercase eyebrows or labels above headings.
- One word of a heading in italics or another colour.
- Metadata strung together with "·".
- Arrows inside buttons.
- Grids of identical cards with the same shadow.
- A fade-up on every section.
- Text below 14px.
