import { test, expect, Page } from "@playwright/test";
import {
  localDayKey,
  plantsFrom,
  reflectionFor,
  todayState,
  todayTarget,
  type DayEntry,
} from "../src/today";
import { LINES_AFTER } from "../src/dailyLine";

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

/* ───────────── Browser: the home's mailbox ───────────── */

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

/** Reach a control with Tab, as a keyboard user would. */
async function tabTo(
  page: Page,
  role: "link" | "button",
  name: string | RegExp,
) {
  const target = page.getByRole(role, { name });
  for (let i = 0; i < 16; i++) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((el) => el === document.activeElement))
      return target;
  }
  throw Error(`${name} is not reachable with the keyboard`);
}

/** The mailbox ready for new words: after today's entry, "Add another entry";
 *  with a draft from an earlier test open, "Record again" discards it. */
async function openComposer(page: Page) {
  const mic = page.getByRole("button", { name: "Record a voice note" });
  const another = page.getByRole("button", { name: "Add another entry" });
  const discard = page.getByRole("button", { name: "Record again" });
  await expect(mic.or(another).or(discard)).toBeVisible();
  if (await another.isVisible()) await another.click();
  else if (await discard.isVisible()) await discard.click();
  await expect(mic).toBeVisible();
}

async function writeAndKeep(page: Page, words: string) {
  await openComposer(page);
  await page.getByRole("button", { name: "I’d rather write today" }).click();
  await page.getByRole("textbox", { name: "Your note" }).fill(words);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Keep these words" }).click();
  const review = page.getByRole("dialog", { name: "Here’s what I heard" });
  await expect(review).toBeVisible({ timeout: 20000 });
  await expect(
    review.getByRole("textbox", { name: "Transcript", exact: true }),
  ).toHaveValue(words);
  return review;
}

test("pending: the microphone is the one action, by keyboard, with a visible focus ring", async ({
  page,
}) => {
  await mockEntries(page, []);
  await signInFresh(page);
  await expect(
    page.getByRole("heading", { name: "Welcome, Alex." }),
  ).toBeVisible();
  const mic = await tabTo(page, "button", "Record a voice note");
  const outline = await mic.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe("none");
  await expect(page.getByText("Tap to talk. Up to 2 minutes.")).toBeVisible();
  // Nothing else competes: no planted state, no review window, no stats.
  await expect(page.getByText("Today’s entry is planted.")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // Without consent the microphone asks for the box first.
  await mic.click();
  await expect(page.getByText("Tick the box to continue.")).toBeVisible();
  await expect(page.getByRole("checkbox")).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Stop recording" }),
  ).toHaveCount(0);
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
  await expect(
    page.getByRole("button", { name: "Record a voice note" }),
  ).toBeVisible();
  await expect(page.getByText("Today’s entry is planted.")).toHaveCount(0);
  // The old draft is not silently resumed as today's.
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("in progress: today's unsaved entry reopens its review window", async ({
  page,
}) => {
  const draft = apiEntry("today-draft", new Date(), false, "processing");
  await mockEntries(page, [draft]);
  await page.route("**/api/patient/entries/today-draft", (route) =>
    route.fulfill({ json: draft }),
  );
  await signInFresh(page);
  await expect(
    page.getByRole("dialog", { name: "Listening to your day…" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Record a voice note" }),
  ).toHaveCount(0);
});

test("completed: write from Home, review, plant, then the calm state opens that entry", async ({
  page,
}) => {
  await signInFresh(page);
  const review = await writeAndKeep(
    page,
    "A fictional quiet morning with tea.",
  );
  await expect(review.locator(".pt-reflection")).toContainText(/today/i);
  await review.getByRole("button", { name: "Plant this entry" }).click();
  await expect(page.getByText("Today’s entry is planted.")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // The subtitle now comes from the "with an entry" sentences.
  const sentence = await page.locator(".pt-daily").innerText();
  expect(LINES_AFTER).toContain(sentence);
  const cta = await tabTo(page, "link", "See today’s entry");
  const entryPath = await cta.getAttribute("href");
  expect(entryPath).toMatch(/^\/patient\/entries\//);
  await page.keyboard.press("Enter");
  await page.waitForURL((url) => url.pathname === entryPath);
  await expect(page.getByText("Saved in your journal")).toBeVisible();
  await expect(page.locator(".entry-reflection")).toContainText(/today/i);
  // Back Home: the calm state, still pointing at the same entry.
  await page
    .getByRole("navigation", { name: "Your journal" })
    .getByRole("link", { name: "Home" })
    .click();
  await expect(page.getByText("Today’s entry is planted.")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "See today’s entry" }),
  ).toHaveAttribute("href", entryPath!);
  // The old session route is gone: it returns Home.
  await page.goto("/patient/new");
  await page.waitForURL((url) => url.pathname === "/patient");
  await expect(page.getByText("Today’s entry is planted.")).toBeVisible();
});

test("Record again discards the draft and returns to the mailbox", async ({
  page,
}) => {
  await signInFresh(page);
  const words = "A fictional draft that will be discarded.";
  const review = await writeAndKeep(page, words);
  await review.getByRole("button", { name: "Record again" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // Written words are kept on the page, but the draft is gone from the journal.
  await expect(page.getByRole("textbox", { name: "Your note" })).toHaveValue(
    words,
  );
  const stored = await page.evaluate(async () => {
    const token = sessionStorage.getItem("numa-session");
    const r = await fetch("/api/patient/entries", {
      headers: { Authorization: "Bearer " + token },
    });
    return (await r.json()) as { transcript: string }[];
  });
  expect(stored.some((e) => e.transcript === words)).toBeFalsy();
});

test("the header shows the three places; the leaf only signs out and closes with Escape", async ({
  page,
}) => {
  await signInFresh(page);
  const nav = page.getByRole("navigation", { name: "Your journal" });
  await expect(nav.getByRole("link")).toHaveText([
    "Home",
    "My journal",
    "My garden",
  ]);
  await expect(nav.getByRole("link", { name: "Home" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  const leaf = page.getByRole("button", { name: "Open menu" });
  await leaf.click();
  await expect(
    page.getByRole("button", { name: "Close menu" }),
  ).toHaveAttribute("aria-expanded", "true");
  const signOut = page.getByRole("button", { name: "Sign out" });
  await expect(signOut).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(signOut).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open menu" })).toBeFocused();
  await nav.getByRole("link", { name: "My journal" }).click();
  await expect(nav.getByRole("link", { name: "My journal" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("entry page reads like a page, and edits in place without boxes", async ({
  page,
}) => {
  await signInFresh(page);
  const review = await writeAndKeep(
    page,
    "A fictional evening: soup, a book, an early night.",
  );
  // The full entry, still a draft: editable fields, one primary action, a way to discard.
  await review.getByRole("link", { name: "Open the full entry" }).click();
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
