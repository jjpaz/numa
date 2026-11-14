import { test, expect } from "@playwright/test";
import {
  LINES_AFTER,
  LINES_BEFORE,
  dailyLine,
  localDayNumber,
} from "../src/dailyLine";

// Dates are built in the runner's own time zone, as the browser builds them.
const day = (d: number, hour = 9) => new Date(2026, 10, d, hour, 0);

test.describe("the home's daily sentence (pure logic)", () => {
  test("is the same all day long, morning and night", () => {
    expect(dailyLine(false, day(14, 0))).toBe(dailyLine(false, day(14, 9)));
    expect(dailyLine(false, day(14, 9))).toBe(dailyLine(false, day(14, 23)));
    expect(dailyLine(true, day(14, 7))).toBe(dailyLine(true, day(14, 22)));
  });

  test("changes with another date, and never repeats on the next day", () => {
    expect(dailyLine(false, day(14))).not.toBe(dailyLine(false, day(15)));
    expect(dailyLine(true, day(14))).not.toBe(dailyLine(true, day(15)));
    // A whole year, day after day: no sentence twice in a row.
    for (let i = 0; i < 366; i++) {
      const a = new Date(2026, 0, 1 + i, 12),
        b = new Date(2026, 0, 2 + i, 12);
      expect(dailyLine(false, a)).not.toBe(dailyLine(false, b));
      expect(dailyLine(true, a)).not.toBe(dailyLine(true, b));
    }
  });

  test("picks from the right list, and every sentence comes round", () => {
    expect(LINES_BEFORE).toContain(dailyLine(false, day(14)));
    expect(LINES_AFTER).toContain(dailyLine(true, day(14)));
    const seen = new Set(
      Array.from({ length: LINES_BEFORE.length }, (_, i) =>
        dailyLine(false, new Date(2026, 10, 1 + i, 12)),
      ),
    );
    expect(seen.size).toBe(LINES_BEFORE.length);
  });

  test("follows the local calendar day, not the UTC date", () => {
    expect(localDayNumber(new Date(2026, 10, 14, 0, 5))).toBe(
      localDayNumber(new Date(2026, 10, 14, 23, 55)),
    );
    expect(localDayNumber(new Date(2026, 10, 15, 0, 5))).toBe(
      localDayNumber(new Date(2026, 10, 14, 23, 55)) + 1,
    );
  });
});
