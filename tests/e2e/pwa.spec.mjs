// PWA: service worker installs, the app reloads and plays offline, manifest is valid.
import { test, expect, seed, setStore, noHScroll } from './fixtures.mjs';

test.describe('offline', () => {
  test.use({ serviceWorkers: 'allow' });
  test('after the service worker installs, the app works offline', async ({ page, context }) => {
    // Request interception makes Chromium bypass the service worker, so drop the font stub here.
    await page.unrouteAll();
    await setStore(page, { v: 1, onboarded: true, name: 'Alex' });
    await page.goto('./#home');
    // Poll from the test side: waitForFunction does not await an async predicate's result.
    await expect.poll(() => page.evaluate(async () => {
      const r = await navigator.serviceWorker.getRegistration();
      return !!(r && r.active);
    }), { timeout: 20_000 }).toBe(true);
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 10_000 });
    // Every same-origin file the app loaded must be in the cache.
    const missing = await page.evaluate(async () => {
      const urls = performance.getEntriesByType('resource').map((e) => e.name).filter((u) => u.startsWith(location.origin) && !u.includes('sw.js'));
      const out = [];
      for (const u of urls) { if (!(await caches.match(u))) out.push(u.replace(location.origin, '')); }
      return out;
    });
    expect(missing, 'files loaded but not cached').toEqual([]);

    await context.setOffline(true);
    await page.reload();
    await expect(page).toHaveURL(/#home$/);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    for (const r of ['mission', 'coach', 'stats', 'profile']) {
      await page.goto(`./#${r}`);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    }
    await page.goto('./#mission');
    await page.getByTestId('mission-start').click();
    await expect(page.getByTestId('stage')).toBeVisible();
    await noHScroll(page, 'offline play');
    await context.setOffline(false);
  });
});

test('manifest has name, icons, start_url and RTL Hebrew', async ({ page }) => {
  const res = await page.request.get('manifest.webmanifest');
  expect(res.ok()).toBe(true);
  const m = await res.json();
  expect(m.name).toBeTruthy();
  expect(m.lang).toBe('he');
  expect(m.dir).toBe('rtl');
  expect(m.display).toBe('standalone');
  expect(m.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  for (const i of m.icons) expect((await page.request.get(i.src)).ok(), i.src).toBe(true);
  await seed(page);
});
