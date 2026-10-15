import { defineConfig, devices } from "@playwright/test";

// Browser tests: a real Chrome opens the app, on a desktop and a phone screen.
// The chat API is mocked inside each test, so no API key or real model is needed.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts", // .e2e.ts so Vitest doesn't pick these up
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // CI tests the production build; locally the dev server is reused if it's already running.
    command: process.env.CI ? "npm run start" : "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
