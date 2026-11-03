import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  // All tests share the single "user" account and its one board, so they must not run in parallel.
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:8000",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
