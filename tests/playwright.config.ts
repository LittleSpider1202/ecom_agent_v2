import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  globalSetup: './global.setup.ts',
  testDir: '.',
  testMatch: 'feature-*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    launchOptions: {
      args: ['--proxy-bypass-list=localhost,127.0.0.1'],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
