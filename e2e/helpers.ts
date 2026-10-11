import { execFileSync } from "node:child_process";
import { expect, type Page } from "@playwright/test";

export const MAILPIT = "http://127.0.0.1:54324";
// Must be in ALLOWED_SIGNUP_EMAILS (see .env.local) so the first sign-in creates the account.
export const EMAIL = "jadesuuu@gmail.com";

/** Resets the test user's data to the demo set (scripts/demo-data.mts). */
export function resetDemoData() {
  execFileSync(process.execPath, ["scripts/demo-data.mts", EMAIL], { stdio: "pipe" });
}

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

export async function signIn(page: Page) {
  await page.goto("/login");
  const sentAt = Date.now() - 1000;
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await page.goto(await latestMagicLink(page, EMAIL, sentAt));
  await expect(page).toHaveURL(/localhost:3000\/$/);
}
