import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 180_000, // 3 min per test to allow manual CAPTCHA solving
  expect: {
    timeout: 15_000,
  },
  retries: 1,
  workers: 1,
  reporter: "list",
});
