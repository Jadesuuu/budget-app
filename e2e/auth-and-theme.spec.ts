import { expect, test, type Page } from "@playwright/test";

const MAILPIT = "http://127.0.0.1:54324";
// Must be in ALLOWED_SIGNUP_EMAILS (see .env.local) so the first sign-in creates the account.
const EMAIL = "jadesuuu@gmail.com";

async function latestMagicLink(page: Page, to: string, after: number): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const res = await page.request.get(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`);
    const body = (await res.json()) as { messages: { ID: string; Created: string }[] };
    const fresh = body.messages.find((m) => Date.parse(m.Created) >= after);
    if (fresh) {
      const msg = (await (await page.request.get(`${MAILPIT}/api/v1/message/${fresh.ID}`)).json()) as { HTML: string; Text: string };
      const link = (msg.Text + msg.HTML).match(/https?:\/\/[^\s"'<>]+verify[^\s"'<>]+/)?.[0];
      if (link) return link.replace(/&amp;/g, "&");
    }
    await page.waitForTimeout(500);
  }
  throw new Error(`No sign-in email for ${to}`);
}

async function signIn(page: Page) {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  const sentAt = Date.now() - 1000;
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await page.goto(await latestMagicLink(page, EMAIL, sentAt));
  await expect(page).toHaveURL(/localhost:3000\/$/);
}

test("signed-out visitors are sent to the login page", async ({ page }) => {
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("an address that is not invited gets the same reply and no account", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("stranger@example.com");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  const res = await page.request.get(`${MAILPIT}/api/v1/search?query=${encodeURIComponent("to:stranger@example.com")}`);
  expect(((await res.json()) as { messages: unknown[] }).messages).toHaveLength(0);
});

test("sign in with a magic link, pick a theme, and keep it after reload", async ({ page }, testInfo) => {
  await signIn(page);
  await expect(page.getByRole("heading", { name: "To review" })).toBeVisible();
  await page.screenshot({ path: `.impeccable/review/app-home-${testInfo.project.name}.png`, fullPage: true });

  await page.goto("/settings");
  await expect(page.getByText(/@in\.jadebonifacio\.dev$/)).toBeVisible();
  await page.locator("label.theme-card", { hasText: "Courtside" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "courtside");
  await page.locator("label.seg-opt", { hasText: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-mode", "dark");
  await expect(page.getByText("Saved to your profile")).toBeVisible();
  await page.screenshot({ path: `.impeccable/review/app-settings-${testInfo.project.name}.png`, fullPage: true });

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "courtside");
  await expect(page.locator("html")).toHaveAttribute("data-mode", "dark");

  // Put it back so runs are repeatable.
  await page.locator("label.theme-card", { hasText: "Sakura" }).click();
  await page.locator("label.seg-opt", { hasText: "Match device" }).click();
  await expect(page.getByText("Saved to your profile")).toBeVisible();
});

test("sign out returns to the login page", async ({ page }) => {
  await signIn(page);
  await page.goto("/more");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});
