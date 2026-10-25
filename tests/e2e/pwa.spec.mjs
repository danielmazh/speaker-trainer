// PWA: service worker installs, the app reloads and plays offline, manifest is valid,
// and app updates arrive as one complete set, with the toast, never during a task.
import { createServer } from 'node:http';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, seed, setStore, noHScroll, STORE_KEY } from './fixtures.mjs';

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

// A private copy of the app on its own server, so a test can "deploy" changed files.
// Google Fonts links are removed from the copy: no real network in this test.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
async function siteCopy() {
  const dir = mkdtempSync(join(tmpdir(), 'st-sw-'));
  for (const f of ['index.html', 'sw.js', 'manifest.webmanifest', 'css', 'js', 'icons']) cpSync(join(ROOT, f), join(dir, f), { recursive: true });
  const ix = join(dir, 'index.html');
  writeFileSync(ix, readFileSync(ix, 'utf8').replace(/^.*fonts\.(googleapis|gstatic)\.com.*$/gm, ''));
  const server = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = join(dir, p);
    if (!f.startsWith(dir) || !existsSync(f) || !statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(readFileSync(f));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const edit = (file, fn) => { const f = join(dir, file); writeFileSync(f, fn(readFileSync(f, 'utf8'))); };
  const close = () => new Promise((r) => server.close(() => { rmSync(dir, { recursive: true, force: true }); r(); }));
  return { base, edit, close };
}

test.describe('updates', () => {
  test.use({ serviceWorkers: 'allow' });
  test('a release without a VERSION bump arrives as one set, with the toast, twice, never during a task', async ({ page }) => {
    test.setTimeout(90_000);
    await page.unrouteAll(); // request interception would bypass the service worker
    const site = await siteCopy();
    try {
      const toast = page.locator('.toast.has-action', { hasText: 'גרסה חדשה מוכנה' });
      const rev = () => page.evaluate(() => ({ js: window.__rev || 0, html: document.querySelector('meta[name="rev"]')?.content || '' }));
      const setRev = (n, html = false) => {
        site.edit('js/ui/home.js', (t) => `${t.replace(/\nwindow\.__rev = \d+;\n$/, '')}\nwindow.__rev = ${n};\n`);
        if (html) site.edit('index.html', (t) => t.replace(/<meta name="rev"[^>]*>\n?/, '').replace('<title>', `<meta name="rev" content="${n}">\n  <title>`));
      };
      // Ask the worker to check now (what the page does when it is shown again).
      const check = async () => {
        await page.waitForTimeout(3200); // CHECK_GAP_MS in sw.js
        await page.evaluate(() => navigator.serviceWorker.controller.postMessage({ type: 'CHECK_UPDATE' }));
      };

      await page.goto(`${site.base}manifest.webmanifest`);
      await page.evaluate(([k]) => { localStorage.clear(); localStorage.setItem(k, JSON.stringify({ v: 1, onboarded: true, name: 'Alex' })); }, [STORE_KEY]);
      await page.goto(`${site.base}#home`);
      await expect.poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.active), { timeout: 20_000 }).toBe(true);
      await page.reload();
      await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 10_000 });
      expect(await rev()).toEqual({ js: 0, html: '' });

      // 1. New index.html and new JS, no VERSION bump. The open page keeps the old set,
      //    and a plain reload before the switch never mixes new HTML with old JS.
      setRev(1, true);
      await check();
      await expect(toast).toBeVisible({ timeout: 15_000 });
      expect(await rev()).toEqual({ js: 0, html: '' });
      await toast.getByRole('button', { name: 'רענן' }).click();
      await expect.poll(rev, { timeout: 15_000 }).toEqual({ js: 1, html: '1' });
      await expect(toast).toHaveCount(0);

      // 2. A second release while the same worker runs: announced again.
      setRev(2);
      await check();
      await expect(toast).toBeVisible({ timeout: 15_000 });
      await toast.getByRole('button', { name: 'רענן' }).click();
      await expect.poll(rev, { timeout: 15_000 }).toEqual({ js: 2, html: '1' });

      // 3. A release during a task: no toast on the task, it shows on the next screen.
      await page.goto(`${site.base}#mission`);
      await page.getByTestId('mission-start').click();
      await expect(page.getByTestId('stage')).toBeVisible();
      setRev(3);
      await check();
      await page.waitForTimeout(2500);
      await expect(toast).toHaveCount(0);
      await page.goBack(); // nothing answered: leaves at once
      await expect(page).toHaveURL(/#mission$/);
      await expect(toast).toBeVisible({ timeout: 10_000 });
      await toast.getByRole('button', { name: 'רענן' }).click();
      await expect.poll(rev, { timeout: 15_000 }).toEqual({ js: 3, html: '1' });
    } finally {
      await site.close();
    }
  });
});
