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

| Token | Value | Role |
|---|---|---|
| `--n-paper` | `#F8F0DF` | Page background |
| `--n-ivory` | `#F5E6C5` | Paper sheets, halos, text on the dark earth surface |
| `--n-moss` | `#3F422E` | Main ink; the dark "earth" surface |
| `--n-moss-deep` | `#2E3122` | Strong ink: headings, primary text, button text |
| `--n-ink-soft` | `#5F5643` | Secondary text (6.4:1 on paper, 5.9:1 on ivory) |
| `--n-apricot` | `#D78B30` | **Only** the flower and the primary action |
| `--n-natural` | `#9F886F` | Decorative only (leaves, underlines, rules). Never text |
| `--n-sage` | `#A3AC84` | Leaves. Never text |
| `--n-focus` | `#8A5A22` | Focus ring: 2px outline, 3px offset |

All text meets WCAG AA. Ivory at 75% opacity on moss (5.5:1) is the lowest
contrast allowed for small text on the earth surface.

## Type

| Token | Value | Use |
|---|---|---|
| `--n-font-display` | Young Serif, weight 400 only | Headings and quoted words |
| `--n-font-ui` | Hanken Grotesk Variable, 400 / 500 / 600 | Text and interface |

Both fonts are self-hosted through `@fontsource` packages, so nothing depends on
Google Fonts or a CDN.

- Scale (px): **14 · 16 · 18 · 21 · 28 · 36 · 48 · 72 · 96** (`--n-text-*`).
- Line height: 1.55 for text, 1.02–1.08 for large headings.
- Display letter-spacing: −0.02em.
- Minimum size: 14px. Dates use tabular figures.

## Shape

Radius follows hierarchy; it is never one value for everything.

| Token | Value | Use |
|---|---|---|
| `--n-radius-sheet` | 6px | Paper sheets |
| `--n-radius-field` | 12px | Inputs and fields |
| `--n-radius-pebble` | 999px | Buttons (pebble shape) |

## Lines and paper

| Token | Value | Use |
|---|---|---|
| `--n-stroke` | 1.75px | The voice line and the stem, at every width |
| `--n-sheet-border` | `rgb(46 49 34 / .12)` | 1px border on paper sheets |
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
