import { test, expect, Page } from "@playwright/test";

// Switching account or portal inside one tab, without signing out first.
type Account = "patient" | "sample" | "psychologist";
const LOGIN: Record<
  Account,
  { url: string; password: string; submit: string }
> = {
  patient: {
    url: "/login/patient",
    password: "journal-demo",
    submit: "Open my journal",
  },
  sample: {
    url: "/login/patient?sample=1",
    password: "sample-demo",
    submit: "Explore the sample",
  },
  psychologist: {
    url: "/login/psychologist",
    password: "care-demo",
    submit: "Open practice dashboard",
  },
};

/** Fill and submit the sign-in form that is already on screen. */
async function submitLogin(page: Page, account: Account) {
  await page
    .getByRole("button", { name: LOGIN[account].password, exact: false })
    .click();
  await page
    .getByRole("button", { name: LOGIN[account].submit, exact: true })
    .click();
}

async function signIn(page: Page, account: Account) {
  await page.goto("/");
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(LOGIN[account].url);
  await submitLogin(page, account);
  await page.waitForURL(
    (url) =>
      url.pathname === (account === "psychologist" ? "/clinic" : "/patient"),
  );
}

test("a signed-in patient can open the clinic portal and sign in there", async ({
  page,
}) => {
  await signIn(page, "patient");
  await page.goto("/clinic");
  await page.waitForURL((url) => url.pathname === "/login/psychologist");
  const notice = page.locator(".login-switch");
  await expect(notice).toContainText("You’re signed in as Alex Morgan");
  await expect(
    notice.getByRole("link", { name: "Back to My journal" }),
  ).toHaveAttribute("href", "/patient");
  await expect(
    page.getByRole("heading", { name: "Welcome to your practice." }),
  ).toBeVisible();
  await submitLogin(page, "psychologist");
  await page.waitForURL((url) => url.pathname === "/clinic");
  await expect(
    page.getByRole("heading", { name: "Your patients", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".patient-row")).toHaveCount(4);
});

test("a signed-in psychologist can open the journal and returns to the page they wanted", async ({
  page,
}) => {
  await signIn(page, "psychologist");
  await page.goto("/patient/journal");
  await page.waitForURL((url) => url.pathname === "/login/patient");
  await expect(page.locator(".login-switch")).toContainText(
    "You’re signed in as",
  );
  await expect(
    page
      .locator(".login-switch")
      .getByRole("link", { name: "Back to Practice dashboard" }),
  ).toHaveAttribute("href", "/clinic");
  await submitLogin(page, "patient");
  // state.from belongs to the new role, so we land where we were going.
  await page.waitForURL((url) => url.pathname === "/patient/journal");
  await expect(
    page.getByRole("heading", { name: "Journal", exact: true }),
  ).toBeVisible();
  await page.goto("/patient");
  await expect(
    page.getByRole("heading", { name: /So good to see you, Alex/ }),
  ).toBeVisible();
});

test("the fresh patient can switch to the sample journal without a redirect", async ({
  page,
}) => {
  await signIn(page, "patient");
  await page.goto("/login/patient?sample=1");
  // No redirect back to the fresh journal: the sample sign-in form is shown.
  await expect(page).toHaveURL(/\/login\/patient\?sample=1$/);
  await expect(
    page.getByRole("heading", { name: "A journal, already growing." }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Demo email" })).toHaveValue(
    "sample@numa.demo",
  );
  await expect(page.locator(".login-switch")).toContainText(
    "You’re signed in as Alex Morgan",
  );
  await submitLogin(page, "sample");
  await page.waitForURL((url) => url.pathname === "/patient");
  await expect(
    page.getByRole("heading", { name: /So good to see you, Robin/ }),
  ).toBeVisible();
  await expect(page.getByText("Today’s entry is planted.")).toBeVisible();
  expect(await page.locator("body").innerText()).not.toContain("Alex");
});

test("the same account is still sent straight to its portal", async ({
  page,
}) => {
  await signIn(page, "patient");
  await page.goto("/login/patient");
  await page.waitForURL((url) => url.pathname === "/patient");
  await expect(page.locator(".login-switch")).toHaveCount(0);
});

test("switching between the two patient pages inside the app swaps the form", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => sessionStorage.clear());
  await page.goto("/login/patient");
  await expect(page.getByRole("textbox", { name: "Demo email" })).toHaveValue(
    "patient@numa.demo",
  );
  // Client-side navigation from the landing page's sample link.
  await page.goto("/");
  await page.getByRole("link", { name: "Open a sample journal" }).click();
  await expect(page.getByRole("textbox", { name: "Demo email" })).toHaveValue(
    "sample@numa.demo",
  );
});
