import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { resetDemoData, signIn } from "./helpers";

// Redacted real bank samples, sent through the real local Worker and capture link, end up in Review.
test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "Server-side flow; one viewport is enough.");

const sendEmail = (file: string) =>
  execFileSync(process.execPath, ["scripts/send-test-email.mts", "--fresh", `fixtures/emails/${file}`], { stdio: "pipe" });

async function reviewUntil(page: Page, text: string) {
  for (let i = 0; i < 20; i++) {
    await page.goto("/review");
    if (await page.getByText(text).first().isVisible()) return;
    await page.waitForTimeout(1000);
  }
}

test("a GCash bank-transfer email becomes a transfer card plus a separate fee", async ({ page }) => {
  resetDemoData();
  await signIn(page);
  sendEmail("gcash/bank-transfer.eml");
  await reviewUntil(page, "Transfer to BPI / VYBE by BPI ••5678");
  await expect(page.locator(".q-row, .txn-card").filter({ hasText: "Transfer to BPI / VYBE by BPI ••5678 fee" }).first()).toContainText("−₱10.00");
});

test("statement emails are noted, not imported", async ({ page }) => {
  await signIn(page);
  sendEmail("eastwest/esoa-sep.eml");
  for (let i = 0; i < 20; i++) {
    await page.goto("/settings/emails");
    if (await page.getByText("Noted").first().isVisible()) break;
    await page.waitForTimeout(1000);
  }
  await expect(page.locator(".email-row", { hasText: "Statement of Account" }).first()).toContainText("Noted");
});

test("a GCash text sent to the capture link becomes a card in Review", async ({ page }) => {
  await signIn(page);
  await page.goto("/settings/phone-capture");
  await page.getByLabel("Name this phone").fill("Sample Android");
  await page.getByRole("button", { name: "Create capture link" }).click();
  const url = (await page.locator(".new-link code").textContent())?.trim() ?? "";
  const res = await page.request.post(url, {
    data: { from: "GCash", text: "You have paid P130.83 GCash to FFT*PINDUOD on 10-09-26 11:30:30 AM. Your new balance is P864.55. Ref. No. 4000000000001." },
  });
  expect(await res.json()).toEqual({ status: "stored" });
  await reviewUntil(page, "FFT*PINDUOD");
  await expect(page.locator(".q-row, .txn-card").filter({ hasText: "FFT*PINDUOD" }).first()).toContainText("₱130.83");
});
