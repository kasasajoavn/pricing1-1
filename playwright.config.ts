import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
export default defineConfig({
  testDir: 'tests',
  testMatch: '*.browser.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: 'http://127.0.0.1:3101',
    headless: true,
    trace: 'retain-on-failure',
    launchOptions: {
      executablePath:
        process.env.CHROMIUM_PATH ||
        (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
      args: ['--no-sandbox'],
    },
  },
  webServer: {
    command: 'node tests/start-server.mjs',
    url: 'http://127.0.0.1:3101/api/health',
    reuseExistingServer: false,
    timeout: 15000,
  },
});
