import { writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { rounded, square } from "./mark.mjs";
// Usage (from the repo root): cp design/icon/*.mjs scripts/ && node scripts/render.mjs <out-dir>  (needs @playwright/test)
const out = process.argv[2];
writeFileSync(`${out}/icon.svg`, rounded());
writeFileSync(`${out}/icon-square.svg`, square());
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage();
async function png(svg, size, file, bg = "transparent") {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:${bg}">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: `${out}/${file}`, omitBackground: bg === "transparent" });
}
await png(rounded(), 512, "icon-512.png");
await png(rounded(), 192, "icon-192.png");
await png(rounded(), 48, "icon-48.png");
await png(square(), 512, "icon-maskable-512.png");
await png(square(0.86), 180, "apple-icon.png");
// Preview sheet: sizes on light and dark, plus a circle mask like Android launchers.
await page.setViewportSize({ width: 900, height: 340 });
const r = rounded(), s = square();
const img = (svg, px, style = "") => svg.replace("<svg ", `<svg width="${px}" height="${px}" style="${style}" `);
await page.setContent(`<html><body style="margin:0;display:flex;font-family:sans-serif">
 ${["#FFF4F7", "#1D1118"].map((bg) => `<div style="background:${bg};flex:1;display:flex;gap:22px;align-items:center;justify-content:center;padding:20px">
   ${img(r, 160)}${img(s, 120, "border-radius:50%")}${img(r, 64)}${img(r, 32)}${img(r, 16)}</div>`).join("")}
</body></html>`);
await page.screenshot({ path: `${out}/preview.png` });
await browser.close();
console.log("rendered");
