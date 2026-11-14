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
    await page.evaluate(async () => {
      const token = sessionStorage.getItem("numa-session");
      if (!token) throw Error("Login completed without a session token");
      const response = await fetch("/api/patient/growth", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ modules: [], simple_mode: false }),
      });
      if (!response.ok)
        throw Error(
          `Could not prepare presentation preferences (${response.status}): ${await response.text()}`,
        );
    });
    await page.reload();
  }
}
// The home has one main action; once today's entry exists it offers "Add another entry".
async function startEntry(page: Page) {
  await page
    .getByRole("link", { name: /^(Add an entry|Add another entry)$/ })
    .click();
  await page.waitForURL((url) => url.pathname === "/patient/new");
}
async function openFromLeafMenu(page: Page, name: "Journal" | "My garden") {
  await page.getByRole("button", { name: "Open menu" }).click();
  await page
    .getByRole("navigation", { name: "Garden menu" })
    .getByRole("link", { name, exact: true })
    .click();
}
test("patient creates a private entry, adds feedback, and psychologist receives trends only", async ({
  page,
  browser,
}) => {
  await signIn(page);
  await startEntry(page);
  await page.getByRole("button", { name: "I’d rather write today" }).click();
  const privateText =
    "E2E private canary: I made a cup of tea and watched the rain.";
  const context = await browser.newContext();
  const clinician = await context.newPage();
  await signIn(clinician, "psychologist");
  await expect(clinician.locator(".patient-row")).toHaveCount(4);
  await page.getByRole("textbox", { name: "Your note" }).fill(privateText);
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Make a little sense of today" })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Transcript", exact: true }),
  ).toHaveValue(privateText);
  await page.locator(".optional-signals > summary").click();
  await expect(
    page.getByText("No explicit feeling was recorded."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save this page" }).click();
  await page.getByRole("button", { name: "I tried this" }).click();
  await page.getByRole("button", { name: "Helpful", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Helpful", exact: true }),
  ).toHaveClass(/selected/);
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
test("fictional profile shows trends, connections are clearly future integrations", async ({
  page,
}) => {
  await signIn(page, "patient", true);
  // Sample history includes today, so the home shows a calm completed state.
  await expect(page.getByText("Today’s entry is planted.")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "See today’s entry" }),
  ).toBeVisible();
  await expect(page.locator(".context-card")).toHaveCount(0);
  await page.screenshot({
    path: "test-results/numa-journal-desktop.png",
    fullPage: true,
  });
  await openFromLeafMenu(page, "My garden");
  await page.getByRole("button", { name: "Explore this pattern" }).click();
  await expect(
    page.getByRole("heading", { name: "What you’ve found helpful" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "My garden", exact: true }).click();
  await page.getByRole("link", { name: "Your space", exact: true }).click();
  await page
    .locator(".space-module")
    .filter({ hasText: "Your voice over time" })
    .getByRole("button")
    .click();
  await page.getByRole("link", { name: "My garden", exact: true }).click();
  await page.getByRole("link", { name: "What helps", exact: true }).click();
  await expect(
    page.locator(".badge").filter({ hasText: "Personal baseline" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/numa-insights-desktop.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "My garden", exact: true }).click();
  await page.getByRole("link", { name: "Your space", exact: true }).click();
  await page.getByRole("link", { name: /Possible future connections/ }).click();
  await expect(
    page.getByText("Not connected · future integration"),
  ).toHaveCount(4);
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

test("landing and patient journal fit a small screen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Some days/ })).toBeVisible();
  await page.screenshot({
    path: "test-results/numa-landing-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await signIn(page, "patient", true);
  await expect(
    page.getByRole("heading", { name: /So good to see you/ }),
  ).toBeVisible();
  await expect(page.locator(".context-card")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await openFromLeafMenu(page, "Journal");
  await expect(page.locator(".log-entry")).toHaveCount(12);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await openFromLeafMenu(page, "My garden");
  await expect(page.getByRole("heading", { name: "My garden" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/numa-journal-mobile.png",
    fullPage: true,
  });
});

test("browser microphone path records real media frames and permits manual recovery", async ({
  browser,
}) => {
  // A generated browser media device, never the host user's real microphone.
  const context = await browser.newContext({ permissions: ["microphone"] });
  const page = await context.newPage();
  await signIn(page);
  await startEntry(page);
  await page
    .getByRole("button", { name: "Record a voice note", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Stop recording" }),
  ).toBeVisible();
  await page.waitForTimeout(3800);
  await page.getByRole("button", { name: "Stop recording" }).click();
  await expect(
    page.getByRole("button", { name: "Record again" }),
  ).toBeVisible();
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Make a little sense of today" })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Transcript", exact: true }),
  ).toBeVisible();
  await page.locator(".optional-signals > summary").click();
  await expect(
    page.getByText("Measured acoustics · ML not active"),
  ).toBeVisible();
  await expect(page.locator(".voice-facts")).toContainText("s recorded");
  await page
    .getByRole("textbox", { name: "Transcript", exact: true })
    .fill("A fictional walk in the park.");
  await page
    .getByRole("textbox", { name: "A little summary" })
    .fill("An afternoon walk.");
  await page.getByRole("button", { name: "Save this page" }).click();
  await expect(
    page.getByRole("button", { name: "I tried this" }),
  ).toBeVisible();
  await context.close();
});

test("space grows only by choice; simple view keeps every module and journal page", async ({
  page,
}) => {
  await signIn(page, "patient", true);
  await expect(page.locator(".garden-hero")).toBeVisible();
  // Softened Everforest cream (--cream #f4eedb).
  expect(
    await page.evaluate(() => getComputedStyle(document.body).backgroundColor),
  ).toBe("rgb(244, 238, 219)");
  await expect(page.locator(".context-card")).toHaveCount(0);
  await openFromLeafMenu(page, "My garden");
  await expect(page.locator(".context-card")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "What helps", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Your space", exact: true }).click();
  await page
    .locator(".space-module")
    .filter({ hasText: "Rest & recovery" })
    .getByRole("button")
    .click();
  await page
    .locator(".space-module")
    .filter({ hasText: "Music & moments" })
    .getByRole("button")
    .click();
  await page.screenshot({
    path: "test-results/numa-your-space.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "My garden", exact: true }).click();
  await expect(page.locator(".context-card")).toHaveCount(2);
  // The home stays minimal: chosen context lives in My garden, not on the home.
  await page.getByRole("link", { name: "Your garden home" }).click();
  await expect(page.locator(".garden-hero")).toBeVisible();
  await expect(page.locator(".context-card")).toHaveCount(0);
  await openFromLeafMenu(page, "My garden");
  await page.screenshot({
    path: "test-results/numa-chosen-modules.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Today, something simple" }).click();
  await page.waitForURL((url) => url.pathname === "/patient");
  await openFromLeafMenu(page, "My garden");
  await expect(
    page.getByRole("button", { name: "Back to my space" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".context-card")).toHaveCount(0);
  await expect(page.locator(".growth-invitation")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Back to my space" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to my space" }).click();
  await page.waitForURL((url) => url.pathname === "/patient");
  await openFromLeafMenu(page, "My garden");
  await expect(page.locator(".context-card")).toHaveCount(2);
  await openFromLeafMenu(page, "Journal");
  await expect(page.locator(".log-entry")).toHaveCount(12);
});

test("a personal intention and experiment can be chosen, paused and reflected on", async ({
  page,
}) => {
  await signIn(page);
  await openFromLeafMenu(page, "My garden");
  await page.getByRole("link", { name: "Your space", exact: true }).click();
  await page
    .locator(".space-module")
    .filter({ hasText: "One small intention" })
    .getByRole("button")
    .click();
  await page
    .getByRole("textbox", { name: "A habit you would like to make room for" })
    .fill("Tea away from my screen");
  await page.getByRole("button", { name: "Keep this intention" }).click();
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
  await page.getByRole("link", { name: "My garden", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Tea away from my screen" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "I made room for this" }).click();
  await expect(
    page.getByRole("button", { name: "Noted for today" }),
  ).toHaveAttribute("aria-pressed", "true");
});
