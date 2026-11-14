// The home's subtitle: one gentle sentence a day. Pure, no React or browser
// APIs, so Playwright can unit-test it. The same local date always gives the
// same sentence, and the next day always gives a different one.

export const LINES_BEFORE = [
  "Your garden was waiting for you.",
  "A minute is plenty today.",
  "Start anywhere. It all counts.",
  "No perfect words needed.",
  "Whatever today was, there’s room for it here.",
  "A few words are enough.",
  "Say it as it comes.",
  "Nothing to fill in. Just you.",
  "Today can be small.",
  "Your journal is open.",
  "Come as you are.",
  "One thought is a good start.",
  "There’s no wrong way to begin.",
  "Take your time. It’s yours.",
];

export const LINES_AFTER = [
  "You looked after yourself a little today.",
  "Today’s words are safe here.",
  "Something new is growing.",
  "That was enough for today.",
  "Your garden had a little water today.",
];

/** Days since 1 January 1970 for the person's own calendar date. */
export function localDayNumber(now = new Date()) {
  return Math.floor(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000,
  );
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/**
 * Walk the list with a stride that shares no factor with its length: every
 * sentence comes round once per cycle, in an order that does not read as a
 * list, and two consecutive days never repeat.
 */
function pick(lines: string[], day: number) {
  const stride = [5, 3, 7, 2].find((s) => gcd(s, lines.length) === 1) ?? 1;
  const i = (((day * stride) % lines.length) + lines.length) % lines.length;
  return lines[i];
}

export function dailyLine(entryToday: boolean, now = new Date()) {
  return pick(entryToday ? LINES_AFTER : LINES_BEFORE, localDayNumber(now));
}
