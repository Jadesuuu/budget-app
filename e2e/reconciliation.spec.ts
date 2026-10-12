import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { resetDemoData, signIn } from "./helpers";

test.describe.configure({ mode: "serial" });
// Multi-step server flows; the dev server also compiles each page on first visit.
test.setTimeout(120_000);
test.skip(({ isMobile }) => isMobile, "Server-side flow; one viewport is enough.");

async function openAccount(page: Page, name: string) {
  await page.goto("/accounts");
  await page.getByRole("link", { name: new RegExp(`^${name}`) }).click();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
}

async function untilVisible(page: Page, url: string, text: string | RegExp) {
  for (let i = 0; i < 20; i++) {
    await page.goto(url);
    if (await page.getByText(text).first().isVisible()) return;
    await page.waitForTimeout(1000);
  }
}

test("a GCash text with a balance exposes a gap, and typing the app's balance updates the check", async ({ page }, testInfo) => {
  resetDemoData();
  await signIn(page);
  await page.goto("/settings/phone-capture");
  await page.getByLabel("Name this phone").fill("Recon test");
  await page.getByRole("button", { name: "Create capture link" }).click();
  const url = (await page.locator(".new-link code.full-link").textContent())?.trim() ?? "";
  // Demo GCash starts at PHP 4,820.50 a month ago; GCash says PHP 864.55 right after this payment.
  await page.request.post(url, {
    data: { from: "GCash", text: "You have paid P130.83 GCash to FFT*PINDUOD on 10-09-26 11:30:30 AM. Your new balance is P864.55. Ref. No. 4000000000001." },
  });

  await untilVisible(page, "/", "Needs a look");
  await expect(page.locator(".attention")).toContainText("GCash: ₱3,825.12 unaccounted for");
  await page.screenshot({ path: `.impeccable/review/app-home-attention-${testInfo.project.name}.png` });

  await openAccount(page, "GCash");
  await expect(page.locator('[aria-labelledby="check-h"] .check-chip')).toContainText("₱3,825.12 unaccounted");
  await expect(page.getByText("GCash said the balance was ₱864.55")).toBeVisible();

  // What the GCash app shows now: opening 4,820.50 - 130.83 + 1,500 + 5,000 (the pending items).
  await page.getByLabel("Balance GCash shows now").fill("11,189.67");
  await page.getByRole("button", { name: "Check against Budget" }).click();
  await expect(page.locator('[aria-labelledby="check-h"] .check-chip')).toContainText("Matches GCash once you review");
  await page.screenshot({ path: `.impeccable/review/app-account-check-${testInfo.project.name}.png`, fullPage: true });

  // A balance that doesn't match: one tap makes Budget start from the bank's figure.
  await page.getByLabel("Balance GCash shows now").fill("2,000.00");
  await page.getByRole("button", { name: "Check against Budget" }).click();
  await expect(page.locator('[aria-labelledby="check-h"] .check-chip')).toContainText("unaccounted");
  await page.getByRole("button", { name: "Use GCash's balance" }).click();
  await expect(page.locator('[aria-labelledby="check-h"] .check-chip')).toContainText("Matches GCash");
  await expect(page.locator(".balance-value")).toContainText("₱2,000.00");
});

test("importing a history adds only what's missing, and can be undone", async ({ page }) => {
  await signIn(page);
  await openAccount(page, "Maya Wallet");
  await page.getByRole("link", { name: "Import history or statement" }).click();

  const now = new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10);
  const csv = ["Date,Description,Debit,Credit,Balance", `${now},Grab ride,186.00,,"1,064.00"`, `${now},Smart load,99.00,,965.00`].join("\n");
  await page.getByLabel("History or statement file").setInputFiles({ name: "maya.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByRole("button", { name: "Check file" }).click();
  await expect(page.getByText("maya.csv: 2 transactions. 1 are already in Budget")).toBeVisible();
  await expect(page.locator(".import-preview .row", { hasText: "Smart load" })).toContainText("−₱99.00");

  await page.getByRole("button", { name: "Add 1 to Review" }).click();
  await expect(page.getByText("1 already in Budget, 1 added to Review")).toBeVisible();

  await page.reload();
  await expect(page.locator(".row", { hasText: "maya.csv" })).toContainText("1 added");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator(".row", { hasText: "maya.csv" })).toHaveCount(0);
  await page.goto("/review");
  await expect(page.locator(".q-row, .txn-card").filter({ hasText: "Smart load" })).toHaveCount(0);
});

test("an EastWest statement email fills in the due date and minimum", async ({ page }) => {
  await signIn(page);
  execFileSync(process.execPath, ["scripts/send-test-email.mts", "--fresh", "fixtures/emails/eastwest/esoa-sep.eml"], { stdio: "pipe" });
  await untilVisible(page, "/", "₱911.21");
  await expect(page.locator(".due-row", { hasText: "₱911.21" })).toContainText("EastWest ••8830");

  await openAccount(page, "EastWest");
  await expect(page.locator(".due-row", { hasText: "Due Oct 21, 2026" })).toContainText("₱26,034.58");
  await expect(page.getByText("EastWest said you owed ₱26,034.58")).toBeVisible();
});
