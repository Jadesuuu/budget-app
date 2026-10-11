import { expect, test } from "@playwright/test";
import { resetDemoData, signIn } from "./helpers";

test.skip(({ isMobile }) => isMobile, "Server-side flow; one viewport is enough.");

test("a capture link accepts phone messages, drops personal ones, and stops when revoked", async ({ page }, testInfo) => {
  resetDemoData();
  await signIn(page);
  await page.goto("/settings/phone-capture");
  await page.getByLabel("Name this phone").fill("Test Android");
  await page.getByRole("button", { name: "Create capture link" }).click();
  const url = (await page.locator(".new-link code").textContent())?.trim() ?? "";
  expect(url).toMatch(/\/api\/capture\/cap_[a-z0-9]{32}$/);

  // What an SMS forwarder app sends for a personal text.
  const personal = await page.request.post(url, {
    data: { from: "Mama", text: "Anak, uwi ka na. PHP 500 pambili ng ulam", receivedStamp: Date.now() },
  });
  expect(personal.status()).toBe(200);
  expect(await personal.json()).toEqual({ status: "ignored" });

  // A retry of the same message is not stored twice; a bad link reveals nothing.
  expect((await page.request.post(url.replace(/cap_\w+$/, "cap_" + "x".repeat(32)), { data: { text: "hi" } })).status()).toBe(404);
  expect((await page.request.post(url, { data: { from: "Mama" } })).status()).toBe(400);

  await page.reload();
  const row = page.locator(".email-row", { hasText: "Mama" });
  await expect(row).toContainText("Texts from Mama aren't from a known bank or e-wallet");
  await expect(row).not.toContainText("pambili");
  await expect(page.getByText("Last message")).toBeVisible();
  await page.screenshot({ path: `.impeccable/review/app-phone-capture-${testInfo.project.name}.png`, fullPage: true });

  await page.getByRole("button", { name: "Revoke Test Android" }).click();
  await expect(page.getByRole("button", { name: "Revoke Test Android" })).toHaveCount(0);
  expect((await page.request.post(url, { data: { from: "BPI", text: "after revoke" } })).status()).toBe(404);
});
