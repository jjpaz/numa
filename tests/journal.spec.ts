import { test, expect, Page } from "@playwright/test";
test.beforeAll(async ({ request }) => {
  const login = await request.post("http://127.0.0.1:8001/api/auth/login", {
    data: { email: "patient@numa.demo", password: "journal-demo" },
  });
  expect(login.status()).toBe(200);
  const { token } = await login.json();
  const proxied = await request.get("http://127.0.0.1:5174/api/auth/me", {
    headers: { Authorization: "Bearer " + token },
  });
  expect(
    proxied.status(),
    "Frontend proxy must use the isolated test API",
  ).toBe(200);
});
async function signIn(page: Page, role = "patient", sample = false) {
  await page.goto("/");
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(`/login/${role}${sample ? "?sample=1" : ""}`);
  await page
    .getByRole("button", {
      name:
        role === "psychologist"
          ? "care-demo"
          : sample
            ? "sample-demo"
            : "journal-demo",
      exact: false,
    })
    .click();
  await page
    .getByRole("button", {
      name:
        role === "psychologist"
          ? "Open practice dashboard"
          : sample
            ? "Explore the sample"
            : "Open my journal",
      exact: true,
    })
    .click();
  // A suffix glob also matches /login/patient; wait for the actual authenticated route.
  await page.waitForURL(
    (url) =>
      url.pathname === (role === "psychologist" ? "/clinic" : "/patient"),
  );
  if (role !== "psychologist") {
    // Every test starts with no optional modules in the space.
    await page.evaluate(async () => {
      const token = sessionStorage.getItem("numa-session");
      if (!token) throw Error("Login completed without a session token");
      const response = await fetch("/api/patient/growth", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ modules: [] }),
      });
      if (!response.ok)
        throw Error(
          `Could not prepare presentation preferences (${response.status}): ${await response.text()}`,
        );
    });
    await page.reload();
  }
}
/** The mailbox ready for new words, whatever an earlier test left today. */
async function openComposer(page: Page) {
  const mic = page.getByRole("button", { name: "Record a voice note" });
  const another = page.getByRole("button", { name: "Add another entry" });
  const discard = page.getByRole("button", { name: "Record again" });
  await expect(mic.or(another).or(discard)).toBeVisible();
  if (await another.isVisible()) await another.click();
  else if (await discard.isVisible()) await discard.click();
  await expect(mic).toBeVisible();
}
/** One of the three places, from the header that is always visible. */
async function go(page: Page, name: "Home" | "My journal" | "My garden") {
  await page
    .getByRole("navigation", { name: "Your journal" })
    .getByRole("link", { name, exact: true })
    .click();
}
const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

test("patient creates a private entry, adds feedback, and psychologist receives trends only", async ({
  page,
  browser,
}) => {
  await signIn(page);
  await openComposer(page);
  await page.getByRole("button", { name: "I’d rather write today" }).click();
  const privateText =
    "E2E private canary: I made a cup of tea and watched the rain.";
  const context = await browser.newContext();
  const clinician = await context.newPage();
  await signIn(clinician, "psychologist");
  await expect(clinician.locator(".patient-row")).toHaveCount(4);
  await page.getByRole("textbox", { name: "Your note" }).fill(privateText);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Keep these words" }).click();
  const review = page.getByRole("dialog", { name: "Here’s what I heard" });
  await expect(
    review.getByRole("textbox", { name: "Transcript", exact: true }),
  ).toHaveValue(privateText);
  await review.getByRole("button", { name: "Plant this entry" }).click();
  await expect(page.getByText("Today’s entry is planted.")).toBeVisible();
  await page.getByRole("link", { name: "See today’s entry" }).click();
  // "What Numa noticed" is always visible: nothing to unfold.
  await expect(
    page.getByText("No explicit feeling was recorded."),
  ).toBeVisible();
  await expect(page.getByText("Saved in your journal")).toBeVisible();
  await page.getByRole("button", { name: "I tried this" }).click();
  await page.getByRole("button", { name: "Helpful", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Helpful", exact: true }),
  ).toHaveClass(/selected/);
  // Something helped: the entry's plant flowers.
  await expect(
    page.getByRole("img", { name: /in flower: something helped/ }),
  ).toBeVisible();
  await expect(
    clinician.getByRole("link").filter({ hasText: "Alex Morgan" }),
  ).toContainText("1 activities", { timeout: 9000 });
  await clinician.getByRole("link").filter({ hasText: "Alex Morgan" }).click();
  await expect(
    clinician.getByRole("heading", { name: "Alex Morgan" }),
  ).toBeVisible();
  await expect(clinician.getByText("1 activities completed")).toBeVisible();
  expect(await clinician.locator("body").innerText()).not.toContain(
    privateText,
  );
  await context.close();
});

test("fictional profile: What helps, Connections and Your space live in My garden", async ({
  page,
}) => {
  await signIn(page, "patient", true);
  // Sample history includes today, so the home shows a calm completed state.
  await expect(page.getByText("Today’s entry is planted.")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "See today’s entry" }),
  ).toBeVisible();
  await expect(page.getByText(/read only/)).toBeVisible();
  await expect(page.locator(".context-card")).toHaveCount(0);
  await page.screenshot({
    path: "test-results/numa-journal-desktop.png",
    fullPage: true,
  });
  await go(page, "My garden");
  // What helps is always there, most helpful first, counted in words.
  const helps = page.locator(".mg-helps li");
  await expect(helps.first()).toContainText(/helpful \d+ of \d+ times?/);
  // The growth invitation turns a module on, in Your space.
  await page.getByRole("button", { name: "Explore this pattern" }).click();
  await expect(
    page.getByRole("switch", { name: "What seems to help" }),
  ).toHaveAttribute("aria-checked", "true");
  await expect(
    page.getByText("Which small activities would you like Numa to suggest?"),
  ).toBeVisible();
  await page.getByRole("switch", { name: "Your voice over time" }).click();
  await expect(page.getByText(/Personal baseline/)).toBeVisible();
  await page.screenshot({
    path: "test-results/numa-insights-desktop.png",
    fullPage: true,
  });
  await expect(
    page.getByText("Not connected, a future integration"),
  ).toHaveCount(4);
  await expect(page.locator(".context-card")).toHaveCount(5);
});

test("mobile navigation and psychologist report fit the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await signIn(page, "psychologist");
  await expect(page.locator(".patient-row")).toHaveCount(4);
  await page.screenshot({
    path: "test-results/numa-clinic-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("link")
    .filter({ hasText: "A pattern worth a closer look" })
    .click();
  await page.getByRole("link", { name: "Observation report" }).click();
  await expect(
    page.getByRole("button", { name: "Print / save PDF" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});

test("landing and the three places fit a small screen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Some days/ })).toBeVisible();
  await page.screenshot({
    path: "test-results/numa-landing-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await noOverflow(page)).toBeTruthy();
  await signIn(page, "patient", true);
  await expect(
    page.getByRole("heading", { name: "Welcome, Robin." }),
  ).toBeVisible();
  await expect(page.locator(".context-card")).toHaveCount(0);
  expect(await noOverflow(page)).toBeTruthy();
  // The home is one screen: no scroll.
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= innerHeight,
    ),
  ).toBeTruthy();
  await go(page, "My journal");
  await expect(page.locator(".log-entry")).toHaveCount(12);
  expect(await noOverflow(page)).toBeTruthy();
  await go(page, "My garden");
  await expect(
    page.getByRole("heading", { name: "My garden", level: 1 }),
  ).toBeVisible();
  expect(await noOverflow(page)).toBeTruthy();
  await page.screenshot({
    path: "test-results/numa-journal-mobile.png",
    fullPage: true,
  });
});

test("record from Home with the browser microphone, review, plant, and find it in My journal", async ({
  browser,
}) => {
  // A generated browser media device, never the host user's real microphone.
  const context = await browser.newContext({ permissions: ["microphone"] });
  const page = await context.newPage();
  await signIn(page);
  await openComposer(page);
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Record a voice note", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Stop recording" }),
  ).toBeVisible();
  await page.waitForTimeout(3800);
  await page.getByRole("button", { name: "Stop recording" }).click();
  // Sent automatically: the mailbox opens in place.
  await expect(page.getByRole("dialog")).toBeVisible();
  const review = page.getByRole("dialog", { name: "Here’s what I heard" });
  await expect(review).toBeVisible({ timeout: 30000 });
  const words = review.getByRole("textbox", {
    name: "Transcript",
    exact: true,
  });
  await expect(words).toBeVisible();
  await words.fill("A fictional walk in the park.");
  await review.getByRole("button", { name: "Plant this entry" }).click();
  await expect(page.getByText("Today’s entry is planted.")).toBeVisible();
  // It is in My journal, today, and opens from there.
  await go(page, "My journal");
  const row = page
    .locator(".log-entry")
    .filter({ hasText: "A fictional walk in the park." });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("Today");
  await row.click();
  await expect(page.getByText("Saved in your journal")).toBeVisible();
  await page.getByRole("button", { name: "Edit words" }).click();
  await page
    .getByRole("textbox", { name: "In short" })
    .fill("An afternoon walk.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved in your journal")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "I tried this" }),
  ).toBeVisible();
  // Voice measurements need ffmpeg on the API host. One source line: the
  // backend's own, which says no ML is active.
  await expect(
    page
      .locator(".ep-source")
      .filter({ hasText: /voice model is not enabled|ML not active/ }),
  ).toHaveCount(1);
  await expect(page.locator(".voice-facts")).toContainText("seconds recorded");
  await context.close();
});

test("My garden shows its three sections with no modules, and never a list of entries", async ({
  page,
}) => {
  await signIn(page, "patient", true);
  // The patient's space sits on --n-cream (#F6EFDD).
  await expect(page.locator(".pt-app")).toHaveCSS(
    "background-color",
    "rgb(246, 239, 221)",
  );
  await expect(page.locator(".context-card")).toHaveCount(0);
  await go(page, "My garden");
  for (const name of ["What helps", "Connections", "Your space"])
    await expect(page.getByRole("heading", { name, level: 2 })).toBeVisible();
  await expect(
    page.getByRole("img", { name: /^Your garden: 12 small plants/ }),
  ).toBeVisible();
  await expect(page.locator(".log-entry")).toHaveCount(0);
  await expect(page.getByText("Recent entries")).toHaveCount(0);
  await expect(page.locator(".context-card")).toHaveCount(5);
  // No module is on, and every switch says so in words.
  const switches = page.getByRole("switch");
  await expect(switches).toHaveCount(6);
  await expect(page.getByText("In your space")).toHaveCount(0);
  // The ground below the meadow is green, down to the footer.
  await expect(page.locator(".mg-ground")).toHaveCSS(
    "background-color",
    "rgb(78, 107, 69)",
  );
  // The anchor links reach each section.
  await page
    .getByRole("navigation", { name: "On this page" })
    .getByRole("link", { name: "Your space" })
    .click();
  await expect(page).toHaveURL(/#your-space$/);
  // Choices are kept: two modules on, after a reload too.
  await page.getByRole("switch", { name: "Rest & recovery" }).click();
  await expect(
    page.getByRole("switch", { name: "Rest & recovery" }),
  ).toHaveAttribute("aria-checked", "true");
  await page.getByRole("switch", { name: "Music & moments" }).click();
  await expect(page.getByText("In your space")).toHaveCount(2);
  await page.screenshot({
    path: "test-results/numa-your-space.png",
    fullPage: true,
  });
  await page.reload();
  await expect(
    page.getByRole("switch", { name: "Music & moments" }),
  ).toHaveAttribute("aria-checked", "true");
  // The home stays minimal: chosen context never reaches it.
  await go(page, "Home");
  await expect(page.locator(".context-card")).toHaveCount(0);
  await go(page, "My journal");
  await expect(page.locator(".log-entry")).toHaveCount(12);
});

test("the old routes lead to their new places", async ({ page }) => {
  await signIn(page, "patient", true);
  for (const [from, to] of [
    ["/patient/insights", "/patient/garden#what-helps"],
    ["/patient/connections", "/patient/garden#connections"],
    ["/patient/space", "/patient/garden#your-space"],
  ]) {
    await page.goto(from);
    await page.waitForURL((url) => url.pathname + url.hash === to);
    await expect(
      page.getByRole("heading", { name: "My garden", level: 1 }),
    ).toBeVisible();
  }
  await page.goto("/patient/new");
  await page.waitForURL((url) => url.pathname === "/patient");
});

test('there is no "Today, something simple" anywhere', async ({ page }) => {
  await signIn(page, "patient", true);
  const none = async () => {
    await expect(page.locator(".pt-main")).toBeVisible();
    await expect(page.getByText(/something simple/i)).toHaveCount(0);
    await expect(page.getByText("Back to my space")).toHaveCount(0);
  };
  await none();
  await go(page, "My journal");
  await expect(page.locator(".log-entry")).toHaveCount(12);
  await none();
  await page.locator(".log-entry").first().click();
  await expect(page.locator(".ep-sheet")).toBeVisible();
  await none();
  await go(page, "My garden");
  await expect(page.getByRole("heading", { name: "Your space" })).toBeVisible();
  await none();
});

test("a personal intention and experiment can be chosen, paused and reflected on", async ({
  page,
}) => {
  await signIn(page);
  await go(page, "My garden");
  await page.getByRole("switch", { name: "One small intention" }).click();
  await page
    .getByRole("textbox", { name: "A habit you would like to make room for" })
    .fill("Tea away from my screen");
  await page.getByRole("button", { name: "Keep this intention" }).click();
  await expect(
    page
      .locator(".mg-habit-name")
      .filter({ hasText: "Tea away from my screen" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "I made room for this" }).click();
  await expect(
    page.getByRole("button", { name: "Noted for today" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Explore personal experiments" })
    .click();
  await page
    .getByRole("textbox", { name: "Something you would like to understand" })
    .fill("What do I notice after a short walk?");
  await page.getByRole("button", { name: "Keep this question" }).click();
  await expect(
    page.getByRole("heading", { name: "What do I notice after a short walk?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pause for now" }).click();
  await expect(page.getByText("Paused, at your pace")).toBeVisible();
  await page.getByRole("button", { name: "Return to this question" }).click();
  await page.getByRole("button", { name: "Finish exploring" }).click();
  await page
    .getByRole("textbox", { name: "What did you notice? (optional)" })
    .fill("I liked making room for something small.");
  await page.getByRole("button", { name: "Keep my reflection" }).click();
  await expect(page.getByText("A question you explored")).toBeVisible();
});
