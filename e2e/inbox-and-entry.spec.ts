import { expect, test, type Page } from "@playwright/test";
import { resetDemoData, signIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  resetDemoData();
  await signIn(page);
});

const frontCard = (page: Page) => page.locator('.txn-card[data-depth="0"]');

test("confirm a transaction, then undo it", async ({ page }, testInfo) => {
  await page.goto("/review");
  await expect(frontCard(page)).toContainText("Jollibee Katipunan");
  await expect(frontCard(page)).toContainText("From BPI email");
  await expect(page.locator(".skeleton")).toHaveCount(0);
  await page.screenshot({ path: `.impeccable/review/app-review-${testInfo.project.name}.png` });

  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Confirmed Jollibee Katipunan" })).toBeVisible();
  await expect(frontCard(page)).toContainText("Received from Carla M.");

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(frontCard(page)).toContainText("Jollibee Katipunan");
  await page.reload();
  await expect(frontCard(page)).toContainText("Jollibee Katipunan");
});

test("a BPI to GCash transfer is suggested and recorded in one tap", async ({ page }) => {
  await page.goto("/review");
  await page.getByRole("button", { name: "Ignore", exact: true }).click();
  await expect(frontCard(page)).toContainText("Received from Carla M.");
  await page.getByRole("button", { name: "Ignore", exact: true }).click();

  await expect(frontCard(page)).toContainText("Looks like a transfer from BPI Savings to GCash");
  await page.getByRole("button", { name: "Confirm as transfer" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Recorded transfer to GCash" })).toBeVisible();
  await expect(page.locator(".txn-card", { hasText: "InstaPay to GCash" })).toHaveCount(0);
  await expect(page.locator(".txn-card", { hasText: "Cash in from BPI" })).toHaveCount(0);
});

test("a duplicate warning can be dismissed", async ({ page }) => {
  await page.goto("/review");
  for (let i = 0; i < 6; i++) {
    if (await frontCard(page).getByText("Possible duplicate").isVisible()) break;
    await page.getByRole("button", { name: "Ignore", exact: true }).click();
    await page.waitForTimeout(300);
  }
  await expect(frontCard(page)).toContainText("MERALCO");
  await expect(frontCard(page)).toContainText("You already have −₱2,341.56 for Meralco, added by you");
  await frontCard(page).getByRole("button", { name: "Not a duplicate" }).click();
  await expect(frontCard(page).getByText("Possible duplicate")).toHaveCount(0);
});

test("add an expense by hand and see it on the account", async ({ page }, testInfo) => {
  await page.goto("/add");
  await page.screenshot({ path: `.impeccable/review/app-add-${testInfo.project.name}.png`, fullPage: true });
  await page.getByLabel("Amount").fill("150");
  await page.getByLabel("What was it for?").fill("Coffee");
  await page.getByRole("combobox", { name: "Account", exact: true }).selectOption({ label: "GCash" });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(/localhost:3000\/$/);

  await page.goto("/accounts");
  await page.getByRole("link", { name: /^GCash/ }).click();
  await expect(page.getByRole("heading", { name: "GCash", level: 1 })).toBeVisible();
  await expect(page.locator(".balance-value")).toHaveText("₱4,670.50");
  await expect(page.locator(".row", { hasText: "Coffee" })).toContainText("−₱150.00");
});

test("record a transfer with a fee", async ({ page }) => {
  await page.goto("/add");
  await page.locator("label.seg-opt", { hasText: "Transfer" }).click();
  await page.getByLabel("Amount").fill("1,000");
  await page.getByRole("combobox", { name: "From", exact: true }).selectOption({ label: "BPI Savings ••7712" });
  await page.getByRole("combobox", { name: "To", exact: true }).selectOption({ label: "Maya Wallet" });
  await page.getByLabel(/^Fee/).fill("15");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(/localhost:3000\/$/);

  await page.goto("/accounts");
  await page.getByRole("link", { name: /^Maya Wallet/ }).click();
  await expect(page.getByRole("heading", { name: "Maya Wallet", level: 1 })).toBeVisible();
  await expect(page.locator(".balance-value")).toHaveText("₱2,250.00");

  // BPI loses the amount and the fee; the fee is its own expense line.
  await page.goto("/accounts");
  await page.getByRole("link", { name: /^BPI Savings/ }).click();
  await expect(page.getByRole("heading", { name: "BPI Savings", level: 1 })).toBeVisible();
  await expect(page.locator(".balance-value")).toHaveText("₱41,485.00");
  await expect(page.locator(".row", { hasText: "Transfer fee" })).toContainText("−₱15.00");
});

test("add an account for a bank that isn't listed", async ({ page }, testInfo) => {
  await page.goto("/accounts/new");
  await page.getByRole("combobox", { name: "Bank or e-wallet", exact: true }).selectOption({ label: "Not listed: add mine" });
  await page.getByLabel("Name of your bank or e-wallet").fill("Cebuana Lhuillier");
  await page.getByRole("combobox", { name: "Type", exact: true }).selectOption({ label: "Savings" });
  await page.getByLabel("Account name").fill("Cebuana Savings");
  await page.getByLabel(/Last 4 digits/).fill("1234");
  await page.getByLabel("Current balance").fill("2,500.75");
  await page.getByRole("button", { name: "Add account" }).click();

  await expect(page.getByRole("heading", { name: "Cebuana Savings" })).toBeVisible();
  await expect(page.locator(".balance-value")).toHaveText("₱2,500.75");
  await expect(page.locator(".balance-meta")).toHaveText("Cebuana Lhuillier, Savings, ••1234");
  await page.goto("/accounts");
  await page.screenshot({ path: `.impeccable/review/app-accounts-${testInfo.project.name}.png`, fullPage: true });
});
