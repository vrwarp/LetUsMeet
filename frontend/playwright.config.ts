import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://localhost:5270';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  timeout: 300000,
  expect: {
    timeout: 60000,
  },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: [
    ['html', { open: 'never' }]
  ],
  use: {
    baseURL,
    trace: 'on-first-retry',
    actionTimeout: 30000,
    navigationTimeout: 45000,
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        baseURL: 'http://127.0.0.1:5270',
        navigationTimeout: 120000,
        actionTimeout: 120000,
      },
    },
    {
      name: 'chromium-mobile',
      use: {
        ...devices['Pixel 5'],
      },
    },
    {
      name: 'webkit-mobile',
      use: {
        ...devices['iPhone 12'],
        baseURL: 'http://127.0.0.1:5270',
        navigationTimeout: 120000,
        actionTimeout: 120000,
      },
    },
  ],
});
