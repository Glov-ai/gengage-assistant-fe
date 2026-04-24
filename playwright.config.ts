import { defineConfig, devices } from '@playwright/test';

// Playwright forces color in worker/web-server processes; keeping NO_COLOR set
// makes Node print a warning before every spawned process.
delete process.env.NO_COLOR;

export default defineConfig({
  globalSetup: './tests/e2e/global-setup.ts',
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /full-stack-smoke|catalog-visual|catalog-components|mobile-/,
      fullyParallel: false,
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'] },
      testMatch: /mobile-/,
    },
    {
      name: 'full-stack',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /full-stack-smoke/,
    },
    {
      name: 'catalog',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:3002',
      },
      testMatch: /catalog-visual|catalog-components/,
    },
  ],
  webServer: [
    {
      command: 'npx vite --port 3001',
      port: 3001,
      reuseExistingServer: !process.env.CI,
      timeout: 90_000,
    },
    {
      command: 'npx vite --config catalog/vite.config.ts --port 3002',
      port: 3002,
      reuseExistingServer: !process.env.CI,
      timeout: 90_000,
    },
  ],
});
