import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';

const systemChromium = ['/usr/bin/chromium', '/usr/bin/google-chrome-stable'].find(p => fs.existsSync(p));

export default defineConfig({
  testDir: './tests/visual',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    viewport: { width: 1280, height: 720 },
    launchOptions: systemChromium ? { executablePath: systemChromium } : undefined,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev -- --port 5173',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30000,
  },
});
