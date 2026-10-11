import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { resetDemoData, signIn } from "./helpers";

// The whole path: local email Worker -> raw_emails -> parse job (called by the Worker) -> Settings.
test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "Server-side flow; one viewport is enough.");

function sendEmail(file: string) {
  execFileSync(process.execPath, ["scripts/send-test-email.mts", "--fresh", `fixtures/emails/_synthetic/${file}`], { stdio: "pipe" });
}

async function reloadUntil(page: Page, check: () => Promise<boolean>) {
  for (let i = 0; i < 20; i++) {
    if (await check()) return;
    await page.waitForTimeout(1000);
    await page.reload();
  }
}

test("Gmail's confirmation code shows up next to the mailbox that asked", async ({ page }) => {
  resetDemoData();
  await signIn(page);
  sendEmail("gmail-forwarding-confirmation.eml");

  await page.goto("/settings");
  const row = page.locator(".source-list .row", { hasText: "someone.example@gmail.com" });
  await reloadUntil(page, () => row.isVisible());
  await expect(row).toContainText("Added by Gmail confirmation");
  await expect(row.locator(".code-value")).toHaveText("123456789");
});

test("an email from an unknown sender is held back, not imported", async ({ page }) => {
  await signIn(page);
  sendEmail("auto-forward.eml");

  await page.goto("/settings/emails");
  const row = page.locator(".email-row", { hasText: "Card transaction alert" }).first();
  await reloadUntil(page, async () => (await row.textContent())?.includes("Held back") ?? false);
  await expect(row).toContainText("alerts@testbank.example isn't a known bank or e-wallet sender");
  await expect(row.getByRole("button", { name: "Try again" })).toBeVisible();

  await page.goto("/review");
  await expect(page.locator(".txn-card", { hasText: /JOLLIBEE KATIPUNAN/ })).toHaveCount(0);
});
