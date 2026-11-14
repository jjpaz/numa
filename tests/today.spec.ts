import { test, expect, Page } from "@playwright/test";
import {
  localDayKey,
  plantsFrom,
  reflectionFor,
  todayState,
  todayTarget,
  type DayEntry,
} from "../src/today";

// Fixed local-time "now"; Date(y, m, d, h) is interpreted in the runner's own time zone,
// exactly as the browser interprets created_at for the person.
const NOW = new Date(2026, 10, 14, 10, 30);
const at = (day: number, hour: number) =>
  new Date(2026, 10, day, hour, 0).toISOString();
const entry = (
  id: string,
  created_at: string,
  saved: boolean,
  status = "completed",
): DayEntry => ({
  id,
  created_at,
  saved,
  status,
});

test.describe("today's state (pure logic)", () => {
  test("pending when there are no entries", () => {
    const state = todayState([], NOW);
    expect(state.kind).toBe("pending");
    expect(todayTarget(state)).toBe("/patient/new");
  });

  test("pending when only earlier days exist — an old draft is never resumed", () => {
    const state = todayState(
      [
        entry("old-saved", at(13, 9), true),
        entry("old-draft", at(13, 22), false, "failed"),
      ],
      NOW,
    );
    expect(state.kind).toBe("pending");
    expect(todayTarget(state)).toBe("/patient/new");
  });

  test("in progress when today's entry is not saved yet", () => {
    const state = todayState(
      [entry("draft", at(14, 9), false, "processing")],
      NOW,
    );
    expect(state.kind).toBe("in_progress");
    expect(todayTarget(state)).toBe("/patient/entries/draft");
  });

  test("done points to today's saved entry, even with a newer draft", () => {
    const state = todayState(
      [
        entry("yesterday", at(13, 9), true),
        entry("today-saved", at(14, 8), true),
        entry("today-draft", at(14, 10), false),
      ],
      NOW,
    );
    expect(state.kind).toBe("done");
    expect(todayTarget(state)).toBe("/patient/entries/today-saved");
  });

  test("uses the local calendar day, not the UTC date", () => {
    const lateYesterday = new Date(2026, 10, 13, 23, 50).toISOString();
    const earlyToday = new Date(2026, 10, 14, 0, 10).toISOString();
    expect(localDayKey(lateYesterday)).toBe("2026-11-13");
    expect(localDayKey(earlyToday)).toBe("2026-11-14");
    expect(todayState([entry("late", lateYesterday, true)], NOW).kind).toBe(
      "pending",
    );
    expect(todayState([entry("early", earlyToday, true)], NOW).kind).toBe(
      "done",
    );
  });

  test("reflections stay gentle and plants never vanish for absences", () => {
    expect(reflectionFor(entry("a", at(14, 9), true), NOW)).toMatch(/today/i);
    expect(reflectionFor(entry("b", at(14, 9), false, "processing"), NOW)).toBe(
      "Your words are still settling in.",
    );
    const old = [entry("x", at(1, 9), true), entry("y", at(2, 9), true)];
    expect(plantsFrom(old, NOW)).toHaveLength(2);
    for (const p of plantsFrom(old, NOW)) {
      expect([0, 1, 2]).toContain(p.hue);
      expect(p.scale).toBeGreaterThan(0);
    }
  });
});

/* ───────────── Browser: the home's main action ───────────── */

async function signInFresh(page: Page) {
  await page.goto("/");
  await page.evaluate(() => sessionStorage.clear());
  await page.goto("/login/patient");
  await page
    .getByRole("button", { name: "journal-demo", exact: false })
    .click();
  await page
    .getByRole("button", { name: "Open my journal", exact: true })
    .click();
  await page.waitForURL((url) => url.pathname === "/patient");
}

function apiEntry(
  id: string,
  created: Date,
  saved: boolean,
  status = "completed",
) {
  return {
    id,
    patient_id: "p",
    created_at: created.toISOString(),
    saved,
    source: "live",
    status,
    title: "A fictional moment",
    transcript: "",
    summary: "",
    tags: [],
    explicit: [],
    context: {},
    voice: null,
  };
}

async function mockEntries(page: Page, entries: unknown[]) {
  await page.route("**/api/patient/entries", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ json: entries })
      : route.continue(),
  );
}

/** Reach the main action with Tab, as a keyboard user would. */
async function tabTo(page: Page, name: string | RegExp) {
  const target = page.getByRole("link", { name });
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((el) => el === document.activeElement))
      return target;
  }
  throw Error("Main action is not reachable with the keyboard");
}

test("pending: the main action opens a new entry, by keyboard, with a visible focus ring", async ({
  page,
}) => {
  await mockEntries(page, []);
  await signInFresh(page);
  const cta = await tabTo(page, "Add an entry");
  await expect(cta).toHaveAttribute("href", "/patient/new");
  const outline = await cta.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe("none");
  await page.keyboard.press("Enter");
  await page.waitForURL((url) => url.pathname === "/patient/new");
  await expect(page.locator(".today-notice")).toHaveCount(0);
});

test("previous date: yesterday's saved entry and draft do not count as today", async ({
  page,
}) => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  await mockEntries(page, [
    apiEntry("yesterday-saved", yesterday, true),
    apiEntry("yesterday-draft", yesterday, false, "failed"),
  ]);
  await signInFresh(page);
  const cta = page.getByRole("link", { name: "Add an entry" });
  await expect(cta).toHaveAttribute("href", "/patient/new");
  await expect(page.getByText("Today’s entry is planted.")).toHaveCount(0);
  await cta.click();
  await page.waitForURL((url) => url.pathname === "/patient/new");
  // The old draft is not silently resumed or announced as today's.
  await expect(page.locator(".today-notice")).toHaveCount(0);
});

test("in progress: today's unsaved entry is continued instead of restarted", async ({
  page,
}) => {
  await mockEntries(page, [
    apiEntry("today-draft", new Date(), false, "processing"),
  ]);
  await signInFresh(page);
  const cta = page.getByRole("link", { name: "Continue today’s entry" });
  await expect(cta).toHaveAttribute("href", "/patient/entries/today-draft");
  await expect(page.getByRole("link", { name: "Add an entry" })).toHaveCount(0);
});

test("completed: after saving today's entry the main action opens that entry", async ({
  page,
}) => {
  await signInFresh(page);
  await page
    .getByRole("link", { name: /^(Add an entry|Add another entry)$/ })
    .click();
  await page.getByRole("button", { name: "I’d rather write today" }).click();
  await page
    .getByRole("textbox", { name: "Your note" })
    .fill("A fictional quiet morning with tea.");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Make a little sense of today" })
    .click();
  await page.getByRole("button", { name: "Save this page" }).click();
  // Saved state is a sentence now, not a disabled "Saved" button.
  await expect(page.getByText("Saved in your journal")).toBeVisible();
  const entryPath = new URL(page.url()).pathname;
  await expect(page.locator(".entry-reflection")).toContainText(/today/i);

  await page.getByRole("link", { name: "Your garden", exact: true }).click();
  await expect(page.getByText("Today’s entry is planted.")).toBeVisible();
  const cta = await tabTo(page, "See today’s entry");
  await expect(cta).toHaveAttribute("href", entryPath);
  await page.keyboard.press("Enter");
  await page.waitForURL((url) => url.pathname === entryPath);

  // A direct visit to the session route says that today already has an entry.
  await page.goto("/patient/new");
  await expect(page.locator(".today-notice")).toContainText("already planted");
  await expect(page.locator(".today-notice a")).toHaveAttribute(
    "href",
    entryPath,
  );
});

test("leaf menu opens Journal and My garden and closes with Escape", async ({
  page,
}) => {
  await signInFresh(page);
  const leaf = page.getByRole("button", { name: "Open menu" });
  await leaf.click();
  await expect(
    page.getByRole("button", { name: "Close menu" }),
  ).toHaveAttribute("aria-expanded", "true");
  const menu = page.getByRole("navigation", { name: "Garden menu" });
  await expect(menu.getByRole("link")).toHaveText(["Journal", "My garden"]);
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open menu" })).toBeFocused();
});

test("entry page reads like a page, and edits in place without boxes", async ({
  page,
}) => {
  await signInFresh(page);
  await page
    .getByRole("link", { name: /^(Add an entry|Add another entry)$/ })
    .click();
  await page.getByRole("button", { name: "I’d rather write today" }).click();
  await page
    .getByRole("textbox", { name: "Your note" })
    .fill("A fictional evening: soup, a book, an early night.");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Make a little sense of today" })
    .click();
  // Draft: editable fields, one primary action and a way to discard.
  const words = page.getByRole("textbox", { name: "Transcript", exact: true });
  await expect(words).toBeVisible();
  await expect(page.getByRole("button", { name: "Discard draft" })).toHaveCount(
    2,
  );
  await page.getByRole("button", { name: "Save this page" }).click();
  // Saved: reading mode, no textbox, no dead "Saved" button.
  await expect(page.getByText("Saved in your journal")).toBeVisible();
  await expect(words).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Saved" })).toHaveCount(0);
  // Edit, then cancel: nothing changes.
  await page.getByRole("button", { name: "Edit words" }).click();
  await expect(page.getByRole("button", { name: "Save changes" })).toHaveCount(
    0,
  );
  await words.fill("Changed my mind.");
  await expect(
    page.getByRole("button", { name: "Save changes" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.locator(".ep-transcript")).toHaveText(
    "A fictional evening: soup, a book, an early night.",
  );
  // Edit and save.
  await page.getByRole("button", { name: "Edit words" }).click();
  await words.fill("A fictional evening: soup and an early night.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved in your journal")).toBeVisible();
  await expect(page.locator(".ep-transcript")).toHaveText(
    "A fictional evening: soup and an early night.",
  );
  // Deleting asks first, inline.
  await page.getByRole("button", { name: "Delete entry" }).click();
  await expect(
    page.getByText("Delete this entry? This can’t be undone."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Keep it" }).click();
  await expect(
    page.getByRole("button", { name: "Delete entry" }),
  ).toBeVisible();
});
