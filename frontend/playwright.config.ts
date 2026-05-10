import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  timeout: 90000,
  expect: {
    timeout: 15000,
  },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: [
    ['html', { open: 'never' }] // Options: 'always', 'never', or 'on-failure' (default)
  ],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
        navigationTimeout: 120000,
        actionTimeout: 120000,
      },
      timeout: 120000,
    },
  ],
});
