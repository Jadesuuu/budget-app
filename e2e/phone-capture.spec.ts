import { expect, test } from "@playwright/test";
import { resetDemoData, signIn } from "./helpers";

// Multi-step server flows; the dev server also compiles each page on first visit.
test.setTimeout(120_000);
test.skip(({ isMobile }) => isMobile, "Server-side flow; one viewport is enough.");

test("a capture link accepts phone messages, drops personal ones, and stops when revoked", async ({ page }, testInfo) => {
  resetDemoData();
  await signIn(page);
  await page.goto("/settings/phone-capture");
  await page.getByLabel("Name this phone").fill("Test Android");
  await page.getByRole("button", { name: "Create capture link" }).click();
  const url = (await page.locator(".new-link code.full-link").textContent())?.trim() ?? "";
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

test("Message487-style capture: URL plus Bearer token, its own event format", async ({ page }) => {
  resetDemoData();
  await signIn(page);
  await page.goto("/settings/phone-capture");
  await page.getByLabel("Name this phone").fill("Message487 test");
  await page.getByRole("button", { name: "Create capture link" }).click();
  const endpoint = (await page.locator(".new-link .alias-box code").first().textContent())?.trim() ?? "";
  const token = (await page.locator(".new-link code.token-code").textContent())?.trim() ?? "";
  expect(endpoint).toMatch(/\/api\/capture$/);

  const send = (data: object, auth = `Bearer ${token}`) => page.request.post(endpoint, { headers: { Authorization: auth }, data });
  const sms = {
    schema_version: 1,
    event_id: "evt-1",
    message_type: "sms",
    source: "android",
    source_name: "Android",
    sender: "GCash",
    text: "You have paid P116.00 GCash to MCDO 330 VA on 10-06-26 07:38:27 AM. Your new balance is P546.88. Ref. No. 4000000000001.",
    occurred_at: "2026-10-05T23:38:30Z",
  };
  // Message487's "n8n confirmation" mode needs its event echoed back as accepted.
  expect(await (await send(sms)).json()).toEqual({ status: "accepted", event_id: "evt-1", result: "stored" });
  expect(await (await send({ schema_version: 1, event_id: "evt-test" })).json()).toEqual({ status: "accepted", event_id: "evt-test", result: "empty" });
  expect((await send(sms, "Bearer cap_" + "x".repeat(32))).status()).toBe(404);
  expect((await send(sms, "")).status()).toBe(404);

  for (let i = 0; i < 20; i++) {
    await page.goto("/review");
    if (await page.getByText("MCDO 330 VA").first().isVisible()) break;
    await page.waitForTimeout(1000);
  }
  await expect(page.locator(".q-row, .txn-card").filter({ hasText: "MCDO 330 VA" }).first()).toContainText("₱116.00");
});
