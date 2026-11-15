import { test, expect, type Page } from "@playwright/test";

// Leave room for a cold Vite/browser start plus deliberately slow API replies.
test.setTimeout(90000);

async function openClinic(page: Page) {
  await page.goto("/login/psychologist", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "care-demo", exact: false }).click();
  await page.getByRole("button", { name: "Open practice dashboard", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/clinic");
}

test("clinic renders a response slower than its polling interval", async ({ page }) => {
  await page.route("**/api/clinic/patients", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 6500));
    await route.fulfill({ json: [] });
  });
  await openClinic(page);
  await expect(page.locator(".cl-summary")).toContainText("0 people in your care", { timeout: 10000 });
  await expect(page.locator(".loading")).toHaveCount(0);
});

test("clinic shows a slow failure and recovers on the next poll", async ({ page }) => {
  let available = false;
  await page.route("**/api/clinic/patients", async (route) => {
    const succeeds = available;
    await new Promise((resolve) => setTimeout(resolve, 6500));
    await route.fulfill(succeeds
      ? { json: [] }
      : { status: 503, json: { detail: "Patient list temporarily unavailable." } });
  });
  await openClinic(page);
  await expect(page.getByRole("alert")).toHaveText("Patient list temporarily unavailable.", { timeout: 10000 });
  await expect(page.locator(".loading")).toHaveCount(0);
  available = true;
  await expect(page.locator(".cl-summary")).toContainText("0 people in your care", { timeout: 15000 });
  await expect(page.getByRole("alert")).toHaveCount(0);
});
