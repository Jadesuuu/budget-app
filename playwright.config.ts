import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run against the local stack: `pnpm db:start` must be running.
// Uses the installed Chrome (channel: "chrome"), so no browser download is needed.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  // The dev server compiles each route on first visit.
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://localhost:3000",
    channel: "chrome",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"], channel: "chrome" } },
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 }, channel: "chrome" } },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
