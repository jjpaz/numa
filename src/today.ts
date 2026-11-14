// Pure helpers for the patient's garden: today's state, gentle reflections and plants.
// No React or browser APIs here so Playwright can unit-test them directly.

export interface DayEntry {
  id: string;
  created_at: string;
  saved: boolean;
  status: string;
  action?: { kind: string; completed_at?: string; feedback?: string };
}

/** Calendar day in the person's own (browser) time zone, e.g. "2026-11-14". */
export function localDayKey(value: string | Date) {
  const d = typeof value === "string" ? new Date(value) : value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isToday(value: string, now = new Date()) {
  return localDayKey(value) === localDayKey(now);
}

const newestFirst = <T extends DayEntry>(a: T, b: T) =>
  new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

export type TodayState<T extends DayEntry = DayEntry> =
  | { kind: "pending" }
  | { kind: "in_progress"; entry: T }
  | { kind: "done"; entry: T };

/**
 * What "today" means for the main action.
 * - done: an entry created today (local time) has been saved → open it.
 * - in_progress: today's entry exists but is not saved yet → continue that one.
 * - pending: nothing from today. Drafts from earlier days are never resumed here.
 */
export function todayState<T extends DayEntry>(
  entries: T[],
  now = new Date(),
): TodayState<T> {
  const today = entries
    .filter((e) => isToday(e.created_at, now))
    .sort(newestFirst);
  const saved = today.find((e) => e.saved);
  if (saved) return { kind: "done", entry: saved };
  if (today[0]) return { kind: "in_progress", entry: today[0] };
  return { kind: "pending" };
}

export function todayTarget(state: TodayState) {
  return state.kind === "pending"
    ? "/patient/new"
    : "/patient/entries/" + state.entry.id;
}

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++)
    h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

const TODAY_LINES = [
  "Today you took a little more care of yourself.",
  "Today you gave yourself a moment to be heard.",
  "You showed up for yourself today.",
];
const PAST_LINES = [
  "You took a little care of yourself that day.",
  "You gave yourself a moment to be heard.",
  "You made some room for how you were.",
];
const HELPED_LINES = [
  "You found something that helped.",
  "Something small was kind to you that day.",
  "You noticed what helps you. That matters.",
];
const ROOM_LINES = [
  "You made a little room for yourself.",
  "You tried something gentle for yourself.",
  "You gave yourself a small kindness.",
];

/** A short self-care reflection that accompanies each entry. Never evaluative. */
export function reflectionFor(entry: DayEntry, now = new Date()) {
  const today = isToday(entry.created_at, now);
  if (["pending", "processing"].includes(entry.status))
    return "Your words are still settling in.";
  const pick = (lines: string[]) => lines[hash(entry.id) % lines.length];
  if (entry.action?.feedback === "helpful")
    return today
      ? "Today you found something that helps. Keep it close."
      : pick(HELPED_LINES);
  if (entry.action?.completed_at)
    return today
      ? "Today you made a little room for yourself."
      : pick(ROOM_LINES);
  return pick(today ? TODAY_LINES : PAST_LINES);
}

/** Distinct local days with a saved entry in the last `days` days (including today). */
export function daysTended(entries: DayEntry[], days = 14, now = new Date()) {
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - (days - 1),
  );
  return new Set(
    entries
      .filter((e) => e.saved && new Date(e.created_at) >= start)
      .map((e) => localDayKey(e.created_at)),
  ).size;
}

/** Words, not a streak counter. */
export function rhythmPhrase(tended: number) {
  if (tended >= 10) return "you came back most days";
  if (tended >= 5) return "you came back often";
  if (tended >= 2) return "you came back a few times";
  if (tended === 1) return "you came back once";
  return "your garden has been resting";
}

export type PlantKind = "sprout" | "fern" | "flower" | "tuft" | "bud";
export interface Plant {
  id: string;
  kind: PlantKind;
  x: number; // 0..1 across the bed
  row: 0 | 1 | 2; // 0 = back, 2 = front
  scale: number;
  hue: 0 | 1 | 2;
  fresh: boolean; // planted today
}

/**
 * One small plant per saved entry. Constancy over the last two weeks makes the
 * garden fuller; nothing withers or is taken away during absences.
 */
export function plantsFrom(entries: DayEntry[], now = new Date()): Plant[] {
  const saved = entries
    .filter((e) => e.saved)
    .sort(newestFirst)
    .reverse();
  const tended = daysTended(entries, 14, now);
  const vigour = 0.82 + Math.min(tended, 12) * 0.025;
  const kinds: PlantKind[] = [
    "sprout",
    "fern",
    "tuft",
    "bud",
    "fern",
    "sprout",
  ];
  return saved.map((e, i) => {
    const h = hash(e.id);
    const helped = e.action?.feedback === "helpful";
    const slot = (i * 0.618034 + (h % 97) / 970) % 1;
    return {
      id: e.id,
      // Something that helped can bloom; the garden stays mostly wild and green.
      kind:
        (helped && h % 2 === 0) || h % 7 === 0
          ? "flower"
          : kinds[(h >>> 4) % kinds.length],
      x: 0.06 + slot * 0.88,
      row: (h % 3) as 0 | 1 | 2,
      // Unsigned shifts: a signed >> can go negative and break the palette index.
      scale: vigour * (0.85 + ((h >>> 3) % 30) / 100),
      hue: ((h >>> 5) % 3) as 0 | 1 | 2,
      fresh: isToday(e.created_at, now),
    };
  });
}
