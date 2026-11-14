# Numa design system

Numa has two faces that share one type system:

- **The patient's portal** (`/patient/*`): _"The journal that grows with you."_
  A softened Everforest palette, a mailbox, grass and plants. Styled in
  [`src/patient.css`](src/patient.css); pages in [`src/patient/`](src/patient/);
  the garden in [`src/design/Grass.tsx`](src/design/Grass.tsx) and
  [`src/design/Meadow.tsx`](src/design/Meadow.tsx).
- **The public pages and the clinic** (the landing page, login, 404 and
  `/clinic`): paper, moss and apricot, with the voice line. Unchanged by the
  patient portal; described at the end of this document.

Tokens live in [`src/design/tokens.css`](src/design/tokens.css) with the `--n-`
prefix.

## The idea

**The journal that grows with you.** Numa is a quiet mailbox where you leave a
few words each day, and a garden that grows with them. Opening it should feel
like opening a personal letterbox, not a clinical app: a lot of air, one action
per screen, few elements, no statistics on the home. The beautiful details are
few and organic (grass, sprouts, leaves). Nothing childish, nothing corporate.

## The three places

The header always shows them, as 16px text links, the current one underlined
(2px) with `aria-current="page"`:

1. **Home** (`/patient`): the mailbox. Arrive, speak or write, done.
2. **My journal** (`/patient/journal`): the record of every day.
3. **My garden** (`/patient/garden`): what the journal is teaching you
   (What helps, Connections, Your space).

On the left the wordmark (a link to Home, named "Home"); on the right a round
leaf button that opens a small panel with only "Sign out" (Escape closes it and
returns the focus). On phones the three links sit on their own line under the
wordmark; there is no bottom bar. The footer is one 14px sentence: which
preview this is, and that it is a research prototype.

Old routes keep working: `/patient/new` → Home; `/patient/insights`,
`/connections` and `/space` → `/patient/garden#what-helps`, `#connections`,
`#your-space`.

## Tokens

| Token                | Value                         | Role                                                                           |
| -------------------- | ----------------------------- | ------------------------------------------------------------------------------ |
| `--n-cream`          | `#F6EFDD`                     | Page background                                                                |
| `--n-oat`            | `#EFE5CC`                     | The mailbox, the entry's words, fields on the ground                           |
| `--n-forest`         | `#2F3A2E`                     | Main text (10.4:1 on cream, 9.5:1 on oat), the microphone, focus rings         |
| `--n-forest-soft`    | `#56604C`                     | Secondary text (5.8:1 on cream, 5.3:1 on oat)                                  |
| `--n-line`           | `rgb(47 58 46 / 0.14)`        | 1px lines                                                                      |
| `--n-peach`          | `#E9A06B`                     | **Only** the primary action and the flowers (forest on peach 5.5:1)            |
| `--n-grass-1/2/3`    | `#A7B88A` `#7F9A68` `#5F7F52` | The three layers of blades, back to front; leaves                              |
| `--n-ground`         | `#4E6B45`                     | My garden's soil, the "small next step" band, the soil under every blade       |
| `--n-on-ground`      | `#F6EFDD`                     | Text on the ground (5.2:1)                                                     |
| `--n-on-ground-soft` | cream at 92%                  | Secondary text on the ground (4.7:1). 80% would be 4.0:1, so it is not used    |
| `--n-butter`         | `#EBCB7A`                     | Flower centres and tiny details (an invitation's rule, an error icon on green) |
| `--n-danger`         | `#9A3B26`                     | Errors and delete, always with an icon and words (6.0:1 on cream)              |

State is never told by colour alone: switches say "In your space" / "Not
added", a flower means "something helped" and the journal says so in words. On
the ground, errors are cream text with a butter icon (danger red would not be
readable on green).

## Type

Self-hosted (`@fontsource`): **Young Serif** for headings (weight 400 only) and
**Hanken Grotesk** for text and interface. Page `h1` `clamp(40px, 6vw, 72px)`;
text 16–18px with line height 1.55; nothing under 14px; tabular figures in
dates and numbers; no letter-spaced capitals. One `h1` per page.

## Shape

Rounded and soft, like stones and seeds: the mailbox and the entry's sheet
32px, pills for buttons, fields 14px. No grey shadows; the mailbox has one very
short warm shadow. No arrows or icons inside text buttons, no coloured pills,
no "·" between data, no grids of equal cards.

## The new garden

- **Grass** (`Grass.tsx`): blades drawn as filled, tapering, slightly curved
  shapes in three layers (`--n-grass-1` behind, `-2`, `-3` in front) over a band
  of `--n-ground` whose top edge is itself short dark blades, so the soil ends
  in a silhouette, never a straight cut. Heights, widths and leans come from a
  hash of each blade's index (deterministic, with slow "clumps" so it is wild
  and uneven); a wider screen only adds blades.
- **Plants** (`Meadow.tsx`): one per saved entry, placed with `plantsFrom()`
  (kind, position, row, size) from `src/today.ts`, growing between the layers of
  grass (the back row behind the middle blades, the front row in front). The
  kinds are filled shapes with soft edges: a sprout with two leaves, a rosette of
  broad leaves, a spike with grains, a stem with a closed bud. **A plant
  flowers** (5 or 6 peach petals, butter centre) **only when its entry was
  marked "helpful"**; all others stay green. More constancy makes a fuller
  meadow; nothing withers or disappears; no streaks or counters.
- `Meadow` has an `aria-label` in words: "Your garden: 12 small plants, one for
  each entry you have saved." (plus how many have flowered). In the low strip
  it is decorative. `PlantFigure` draws one entry's plant on a small oval patch
  of grass (the journal's rows at 56px, the entry page's header at 200px); a
  draft is a young sprout.
- **Motion:** a plant planted a moment ago grows once from its base (780ms);
  when "Helpful" arrives on the entry page its flower opens once (620ms).
  Everything is drawn in its final state first: nothing depends on an animation
  to be seen, and `prefers-reduced-motion` shows the final state directly.

## Home: the mailbox (`/patient`)

One screen, centred, with no scroll at 1440×900 or 375×812 in every state
(empty, recording, reviewing, planted, error).

- `h1` "Welcome, {first name}." and a daily sentence (`src/dailyLine.ts`): the
  same all day, never the same two days running (the list is walked with a
  stride coprime with its length). Two lists: before today's entry ("A few
  words are enough."…) and after it ("That was enough for today."…).
- **The mailbox:** an oat surface, radius 32, max 640px. Inside: a quiet dotted
  track (the two minutes), the 88px forest microphone ("Record a voice note"),
  "Tap to talk. Up to 2 minutes." and the text link "I'd rather write today",
  which opens, in the same mailbox, a borderless "Your note" (Young Serif 24,
  "Today, I noticed…", autosize) and the button "Keep these words"; "I'd
  rather leave a voice note" goes back without losing the words.
- **Recording:** the button becomes "Stop recording" (a square), the voice line
  is drawn live from the microphone's real loudness (`useVoiceCapture`, ~10
  samples a second, the same 2-minute limit and clean-up as before) and the
  time shows in tabular figures ("0:12 of 2:00"). Nothing else competes.
- **Consent** (word for word, required before the first send): one 22px
  checkbox under the mailbox and a `<details>` "How audio is handled". It is
  remembered on the device (`localStorage`, guarded); after that only a 14px
  "How audio is handled" remains. Pressing the microphone or "Keep these
  words" without it focuses the box and says "Tick the box to continue."
- **The review window:** sending is automatic. The mailbox **expands in place**
  (a non-modal `role="dialog"` labelled by its title; the focus moves to the
  title when the person opened it). While the backend listens: "Listening to
  your day…" over the recording, now still. When ready: "Here's what I heard",
  the transcript in a borderless textarea ("Transcript", Young Serif 21–24; an
  empty one says "Transcription unavailable? Add the words you want to keep."),
  one reflection line, and three actions: **Plant this entry** (the existing
  PATCH, `saved: true`), **Record again** (the existing DELETE, back to the
  mailbox; written words stay in the note) and **Open the full entry**.
  Microphone or sending errors are a sentence with an icon in `--n-danger` and
  "Write a note instead".
- **Planted:** the window folds back to "Today's entry is planted." (icon and
  words), "See today's entry" and "Add another entry"; the new plant grows once
  in the grass; the sentence switches to the "after" list.
- **Arriving:** `todayState()` decides: nothing today → the microphone; today's
  unsaved draft → its review window; a saved entry today → the calm state.
- **The sample** is read only: "This sample journal is read only. Use the fresh
  profile to add your own entries.", with today's entry still one link away.
- **The strip:** at the foot of the screen, full width, a low band of grass
  (~76px) with the plants of the last three weeks peeking out. It is sticky: on
  My journal it stays at the bottom of the screen while the list scrolls and
  rests at the page's end (decorative, `pointer-events: none`; the page keeps
  96px of scroll padding so focus is never hidden behind it).

## Entry page (`/patient/entries/:id`)

Content and behaviour as before: editable words, "What Numa noticed" (voice and
words always apart), "A small next step", feedback, the optional voice
comparison and delete. On the new palette: the words on an oat sheet (radius
32, the mailbox's surface), the next step on a band of `--n-ground` with cream
text and cream pebbles, back links "Home" and "My journal", and the entry's own
plant in the header. While the backend listens, a still voice line and a
breathing dot.

## My journal (`/patient/journal`)

`h1` "My journal", "Every entry you've planted, newest first.", then the rows
by month with 1px lines: the date ("Today" in bold), the entry's plant (56px),
the title, the reflection, the first line of the words and "Something helped"
where it applies; drafts and entries still being read as before. No garden
above the list. Empty: "Your journal is waiting for its first entry." and "Add
an entry" (to Home). The grass strip runs at the foot.

## My garden (`/patient/garden`): on the green ground

1. **The sky** (cream): `h1` "My garden", "The journal that grows with you."
   (Young Serif 28) and one sentence of real numbers: "{n} entries planted. Over
   the last two weeks {rhythm}." Under it, three anchor links (What helps,
   Connections, Your space): smooth scrolling, instant with reduced motion; the
   section's heading takes the focus.
2. **The meadow:** the whole garden, full width (300px on desktop, 230px on a
   phone; just grass, 140px, before the first entry).
3. **The ground:** the meadow's soil is the horizon. From there down the page is
   `--n-ground` to the very end, footer included. The join is the grass's own
   silhouette, never a straight edge or a gradient.
4. **Three sections on the ground**, each an `h2` (Young Serif 40), one
   sentence, and its content visible without a click, separated by air and a
   faint cream line:
   - **What helps** (always shown): the patterns from `/patient/insights`, most
     helpful first, as rows: the activity (Hanken 600 21px), "helpful 6 of 6
     times" in tabular figures and a 6px bar (cream track at 25%, cream fill).
     Without data: "After an entry, try the small next step and tell Numa if it
     helped. Your answers will grow here." and "Add an entry".
   - **Connections:** "The context of your days." with "Simulated data"; today's
     five values in one row (Young Serif 28, 14px labels; two columns on a
     phone); "Possible future connections" (four rows, "Not connected, a future
     integration"); the simulated-data notice.
   - **Your space:** "A little more, only when you want it." Any growth
     invitation (text beside a butter rule). The six modules as rows with a real
     switch (`role="switch"`, named by the module, state in words). Turning one
     on opens its controls under its row: the intention and "I made room for
     this" (One small intention), the activities Numa may suggest (What seems to
     help), the observation chart on an oat panel (Your voice over time). Then
     personal experiments, as before.
5. **Footer on the ground:** the privacy sentence and the prototype notice.

There is never a list of entries on this page.

## Transitions

Navigation in the portal goes through `useFlowNavigate()` / `<FlowLink>`
([`src/design/flow.ts`](src/design/flow.ts)): inside
`document.startViewTransition(() => flushSync(...))` when the browser has it and
motion is welcome, plain navigation otherwise. A new page starts at its top.

- **`ground`**: the strip on Home and My journal, and the meadow with its
  ground on My garden. Going to My garden the grass rises from the bottom to its
  horizon and the green fills the page; leaving, it sinks. Between Home and My
  journal it stays where it is. Each picture is anchored at its top and the
  growing box reveals it, so the grass never stretches.
- **`mailbox`**: the Home mailbox and the entry's sheet of words: "See today's
  entry" and "Open the full entry" turn the mailbox into the sheet.
- **`plant-<id>`**: a journal row's plant and the entry page's header plant.
- **`patient-header`**: the header never moves.
- Shared elements: 520ms, `cubic-bezier(.22, 1, .36, 1)`. Everything else: a
  220ms fade, moving 8px at most. No bounce, no blur. A name is never used twice
  on one page. The entry page draws at once from the journal's data, so its
  plant and sheet are there to move into.

## Layout and accessibility

- Column max 1200px, side padding `clamp(16px, 5vw, 56px)`; nothing overflows at
  360px.
- Every control is reachable by keyboard with a visible ring (2px forest on
  cream, 2px cream on the ground); a skip link leads to the content.
- Touch targets are at least 44px.
- `prefers-reduced-motion`: no view transitions, no growing or opening, instant
  anchor scrolling, the mailbox does not animate its size.

## Avoid

- Statistics, streaks or counters as protagonists; any block on the home other
  than the mailbox (no latest entry, no progress, no patterns, no shelf).
- Peach anywhere but the primary action and the flowers.
- Cards in grids, coloured pills, badges, eyebrows, "·" between data, arrows or
  icons inside text buttons.
- Grey shadows; boxes around the words being written.
- Colour as the only signal of a state.
- Plants that wither, shrink or disappear; a garden that depends on an
  animation to be seen.
- Bouncing, endless motion or blur in transitions.
- A "simple mode": it was removed. The interface ignores `simple_mode` and never
  sends it.

---

## Public pages, login and 404

The landing page ([`src/landing.tsx`](src/landing.tsx)), login and 404 keep the
original identity: `--n-paper` `#F8F0DF`, `--n-ivory` `#F5E6C5`, `--n-moss`
`#3F422E` and `--n-moss-deep` `#2E3122` ink, `--n-ink-soft` `#5F5643`,
`--n-apricot` `#D78B30` for the one primary action and the flower, and
`--n-focus` `#8A5A22` rings. Their voice line is a smooth spline from
[`src/design/voiceLine.ts`](src/design/voiceLine.ts) (seeded PRNG, Gaussian
bursts, Catmull-Rom curves, 1.75px stroke) that turns into a stem and a flower.
Styled in [`src/landing.css`](src/landing.css) and
[`src/secondary.css`](src/secondary.css); the login motif lives in
[`src/loginMotif.tsx`](src/loginMotif.tsx).

- **Login in two zones.** Left (~45%): wordmark, back link, `h1`, sentence and
  form. Right: one calm, static motif: a stretch of voice line ending in a seed
  (new journal) or a flowering plant (sample); for the psychologist a plain moss
  field with "Trends only. Journal entries stay private." in Young Serif 28
  ivory. One column at ≤900px. A session for another account is a sentence
  beside a 3px moss rule; errors are an icon and words in `--n-danger`.
- **One form, two kinds of demo access.** When the backend enables name-only
  access (`demo_name_login`), the form asks only "Your name"; otherwise the
  published demo email and password. While the backend is still being reached,
  "Connecting to your space…".
- **404** is an `h1`, one sentence and an underlined link home (or back to the
  person's own portal).

## Clinic (`/clinic`, `/clinic/patients/:id`, `…/report`)

The psychologist's portal is a professional tool. It shares the public pages'
tokens (paper, moss, apricot) and the type of the whole product, but has its
own identity: **no garden, no plants, no decorative voice line, no earth
band**. Sober, dense and legible; data always in tabular figures. One
protagonist per screen: the table of people on the dashboard, the observation
chart on a person's page. Styled in [`src/clinic.css`](src/clinic.css)
(imported just before `patient.css`); charts in
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
