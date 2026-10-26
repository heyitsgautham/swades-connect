import { defineConfig } from '@playwright/test';

// End-to-end checks of the built extension in Chromium. Run `pnpm run build` first.
export default defineConfig({
  testDir: 'e2e',
  // One browser with the extension loaded at a time; the tests share its chrome.storage.
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
});
