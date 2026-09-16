import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    headless: true,
    // Certificate checks are relaxed only for the local self-signed fixtures:
    // every navigation target in these tests is a local fixture URL
    // (localhost / 127.0.0.1). Playwright has no per-URL narrowing knob, so the
    // guarantee comes from the specs never navigating anywhere else.
    ignoreHTTPSErrors: true,
    serviceWorkers: 'block',
  },
});
