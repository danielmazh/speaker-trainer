// Playwright e2e config. Serves the static app on port 8790 (python http.server).
// Browser: the default Playwright Chromium when installed, else the newest cached one.
import { defineConfig, devices, chromium } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PORT = Number(process.env.E2E_PORT || 8790);

function chromiumPath() {
  if (process.env.PW_CHROMIUM) return process.env.PW_CHROMIUM;
  try { if (existsSync(chromium.executablePath())) return undefined; } catch { /* fall through */ }
  const cache = join(homedir(), 'Library/Caches/ms-playwright');
  const alt = join(homedir(), '.cache/ms-playwright');
  const root = existsSync(cache) ? cache : alt;
  if (!existsSync(root)) return undefined;
  const dirs = readdirSync(root).filter((d) => d.startsWith('chromium_headless_shell-')).sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
  for (const d of dirs) {
    for (const sub of ['chrome-headless-shell-mac-arm64/chrome-headless-shell', 'chrome-headless-shell-mac-x64/chrome-headless-shell', 'chrome-headless-shell-linux64/chrome-headless-shell', 'chrome-linux/headless_shell']) {
      const p = join(root, d, sub);
      if (existsSync(p)) return p;
    }
  }
  return undefined;
}

const executablePath = chromiumPath();
const iphone = devices['iPhone 13'];

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: /.*\.spec\.mjs$/,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}/`,
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
    permissions: ['microphone'],
    trace: 'retain-on-failure',
    launchOptions: {
      ...(executablePath ? { executablePath } : {}),
      args: ['--autoplay-policy=no-user-gesture-required'],
    },
  },
  projects: [
    { name: 'pixel7', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
    {
      name: 'iphone13',
      use: {
        browserName: 'chromium',
        viewport: iphone.viewport,
        screen: iphone.screen,
        deviceScaleFactor: iphone.deviceScaleFactor,
        isMobile: true,
        hasTouch: true,
        userAgent: iphone.userAgent,
      },
    },
    {
      name: 'android360',
      use: { browserName: 'chromium', viewport: { width: 360, height: 740 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
    },
  ],
  webServer: {
    command: `python3 -m http.server ${PORT} --bind 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: true,
    timeout: 20_000,
    stdout: 'ignore',
    stderr: 'ignore',
  },
});
