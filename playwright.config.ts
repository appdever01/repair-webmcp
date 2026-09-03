import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  workers: 2,
  fullyParallel: false,
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm preview --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
  },
  projects: [
    { name: "desktop", testMatch: /manual\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      testMatch: /manual\.spec\.ts/,
      use: { ...devices["iPhone 13"], browserName: "chromium" },
    },
    {
      name: "webmcp",
      testMatch: /webmcp\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: { args: ["--enable-features=WebMCPTesting"] },
      },
    },
  ],
});
