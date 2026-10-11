import { expect, test } from "@playwright/test";
import { resetDemoData, signIn } from "./helpers";

test.setTimeout(120_000);

test("the eye button hides balances everywhere, instantly, and remembers it", async ({ page }, testInfo) => {
  resetDemoData();
  await signIn(page);
  await page.goto("/accounts");
  const balance = page.locator(".acct-bal .private").first();
  await expect(balance.locator(".private-value")).toBeVisible();

  const toggle = page.getByRole("button", { name: "Hide balances" });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(balance.locator(".private-value")).toBeHidden();
  await page.screenshot({ path: `.impeccable/review/app-accounts-hidden-${testInfo.project.name}.png` });

  // Survives a reload with no flash (the pre-paint script reads the cookie) and applies on other pages.
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.hasAttribute("data-hide-balances"))).toBe(true);
  await page.locator(".acct").first().click();
  await expect(page.locator(".balance-value")).toBeVisible();
  await expect(page.locator(".balance-value .private-value")).toBeHidden();

  // The previous page stays mounted but hidden after a client navigation, so pick the visible button.
  await page.getByRole("button", { name: "Hide balances" }).filter({ visible: true }).click();
  await expect(page.locator(".balance-value .private-value")).toBeVisible();
});

test("the phone tab bar stays put while the page scrolls", async ({ page, isMobile }) => {
  test.skip(!isMobile, "The tab bar only exists on phones.");
  resetDemoData();
  await signIn(page);
  await page.goto("/");
  const bar = page.locator("nav.tabbar");
  const before = await bar.boundingBox();
  await page.mouse.wheel(0, 600);
  await page.evaluate(() => window.scrollBy(0, 600));
  await page.waitForTimeout(200);
  const after = await bar.boundingBox();
  expect(after?.y).toBe(before?.y);
  const viewport = page.viewportSize();
  expect((after?.y ?? 0) + (after?.height ?? 0)).toBeCloseTo(viewport?.height ?? 0, 0);
});
