// Service worker: the game works offline, and new releases reach users fast.
// 2026-10-25 (audit 2): the page and its JS/CSS always come from ONE set of files.
// - Page and app files are served cache first from the live cache (CACHE).
// - On every page load (and when the page asks, CHECK_UPDATE) the worker fetches the
//   whole APP_FILES set again with cache: 'no-cache' (never an old HTTP-cache copy). If
//   any file differs, the full new set goes into a staging cache (STAGE) and open pages
//   get 'ASSETS_UPDATED' (toast "גרסה חדשה מוכנה"). Each new set is announced once, so a
//   second release while this worker runs is announced too.
// - The next page load (the "רענן" tap reloads) first moves the staged set into the live
//   cache, then serves index.html. So new HTML never runs with old JS or CSS.
// - A new VERSION (sw.js changed) installs a full new cache and then waits. The page shows
//   the same toast; "רענן" posts SKIP_WAITING and the page reloads on controllerchange.
//   Bump VERSION whenever sw.js changes; app files alone do not need a bump.
// - Google Fonts: the CSS and every font file it lists are cached on first use. Offline,
//   the CSS is served without the faces that are not cached, so no request fails.
// Privacy: nothing about audio ever passes through here. Recordings are blob URLs in page memory.
const VERSION = 'v9-2026-10-25';
const CACHE = `speaker-trainer-${VERSION}`;
const STAGE = `${CACHE}-next`;
const FONT_CACHE = 'speaker-trainer-fonts';
const MARK = './__staged__'; // written last into STAGE: the staged set is complete
const CHECK_GAP_MS = 3000; // checks closer together than this share one result

const APP_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/tokens.css',
  './css/base.css',
  './css/components.css',
  './css/screens.css',
  './css/play.css',
  './js/app.js',
  './js/content.js',
  './js/engine.js',
  './js/speech.js',
  './js/analyze.js',
  './js/data.js',
  './js/theme.js',
  './js/ui/art.js',
  './js/ui/coach.js',
  './js/ui/dom.js',
  './js/ui/fx.js',
  './js/ui/home.js',
  './js/ui/icons.js',
  './js/ui/mic.js',
  './js/ui/mission.js',
  './js/ui/onboarding.js',
  './js/ui/path.js',
  './js/ui/play.js',
  './js/ui/play-choice.js',
  './js/ui/play-fix.js',
  './js/ui/play-qa.js',
  './js/ui/play-recall.js',
  './js/ui/play-shadow.js',
  './js/ui/play-speak.js',
  './js/ui/profile.js',
  './js/ui/result.js',
  './js/ui/shell.js',
  './js/ui/stats.js',
  './js/ui/track.js',
  './js/ui/tts.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
];

// Install fails if any app file fails, so a release never activates with a partial cache.
// The old version keeps serving until a full install succeeds.
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(APP_FILES.map(async (u) => {
      const res = await fetch(new Request(u, { cache: 'reload' }));
      if (!res.ok) throw new Error(`sw: ${u} ${res.status}`);
      await c.put(u, res);
    }));
    // Workers before v6 (cache names v1..v5) have pages without the update toast, so
    // nobody could ever tap "רענן". Take over from them at once, one time only.
    const keys = await caches.keys();
    if (keys.some((k) => /^speaker-trainer-v[1-5]-/.test(k))) await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('speaker-trainer-') && k !== CACHE && k !== FONT_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// ---------- one lock for the live and staging caches ----------
let lock = Promise.resolve();
function serial(fn) {
  const run = lock.then(fn, fn);
  lock = run.catch(() => {});
  return run;
}

const abs = (u) => new URL(u, self.registration.scope).href;

// Move a complete staged set into the live cache. Runs before a page loads.
async function promote() {
  if (!(await caches.has(STAGE))) return false;
  const st = await caches.open(STAGE);
  if (!(await st.match(MARK))) return false;
  const live = await caches.open(CACHE);
  const mark = abs(MARK);
  for (const req of await st.keys()) {
    if (req.url === mark) continue;
    const res = await st.match(req);
    if (res) await live.put(req, res);
  }
  await caches.delete(STAGE);
  return true;
}

async function stagedReady() {
  if (!(await caches.has(STAGE))) return false;
  return !!(await (await caches.open(STAGE)).match(MARK));
}

function sameBytes(a, b) {
  if (a.byteLength !== b.byteLength) return false;
  const x = new Uint8Array(a), y = new Uint8Array(b);
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
}

async function digest(parts) {
  const all = new Uint8Array(parts.reduce((n, p) => n + p.byteLength, 0));
  let o = 0;
  for (const p of parts) { all.set(new Uint8Array(p), o); o += p.byteLength; }
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', all));
  return Array.from(h.slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join('');
}

let announced = ''; // signature of the last set announced to pages
async function announce() {
  const list = await self.clients.matchAll({ type: 'window' });
  list.forEach((c) => c.postMessage({ type: 'ASSETS_UPDATED' }));
}

// Fetch the whole app set past the HTTP cache. Different from the live cache:
// stage it (complete, or not at all) and tell the pages once per new set.
async function runCheck() {
  const reg = self.registration;
  if (reg.installing || reg.waiting) return false; // a new worker brings the new files
  if (self.navigator && self.navigator.onLine === false) return false;
  const live = await caches.open(CACHE);
  let fresh;
  try {
    fresh = await Promise.all(APP_FILES.map(async (u) => {
      const res = await fetch(new Request(u, { cache: 'no-cache' }));
      if (!res.ok || res.type !== 'basic') throw new Error(`sw: ${u} ${res.status}`);
      const buf = await res.arrayBuffer();
      const old = await live.match(u);
      const same = !!old && sameBytes(await old.arrayBuffer(), buf);
      return { u, buf, same, status: res.status, statusText: res.statusText, headers: [...res.headers] };
    }));
  } catch { return false; } // offline or a half-deployed server: try again later
  if (fresh.every((f) => f.same)) {
    await serial(() => caches.delete(STAGE));
    return false;
  }
  const sig = await digest(fresh.map((f) => f.buf));
  await serial(async () => {
    await caches.delete(STAGE);
    const st = await caches.open(STAGE);
    for (const f of fresh) await st.put(f.u, new Response(f.buf, { status: f.status, statusText: f.statusText, headers: f.headers }));
    await st.put(MARK, new Response(sig));
  });
  if (sig !== announced) { announced = sig; await announce(); }
  return true;
}

let checking = null;
let lastCheck = 0;
let lastResult = false;
function checkForUpdate() {
  if (checking) return checking;
  if (Date.now() - lastCheck < CHECK_GAP_MS) return Promise.resolve(lastResult);
  checking = runCheck().catch(() => false).then((r) => {
    lastResult = r;
    lastCheck = Date.now();
    checking = null;
    return r;
  });
  return checking;
}

// The page asks for the new version ("רענן") or for a check (page shown again).
self.addEventListener('message', (e) => {
  const d = e.data;
  if (d === 'SKIP_WAITING' || (d && d.type === 'SKIP_WAITING')) { self.skipWaiting(); return; }
  if (d && d.type === 'CHECK_UPDATE') {
    // Answer from the caches as they are now (a page loaded after the switch gets no toast).
    e.waitUntil(checkForUpdate().then(stagedReady).then((ready) => {
      if (ready && e.source) e.source.postMessage({ type: 'ASSETS_UPDATED' });
    }).catch(() => {}));
  }
});

// The page: switch to a complete staged set first, then serve it from the cache.
async function pageResponse(e) {
  if (await serial(promote).catch(() => false)) lastCheck = 0; // check again against the new set
  e.waitUntil(checkForUpdate());
  const live = await caches.open(CACHE);
  const hit = await live.match('./index.html');
  if (hit) return hit;
  const res = await fetch(e.request); // nothing cached yet (first visit before install)
  if (res && res.ok && res.type === 'basic') e.waitUntil(live.put('./index.html', res.clone()).catch(() => {}));
  return res;
}

// App files: from the live cache. A file not in the set comes from the network once.
async function assetResponse(e) {
  const live = await caches.open(CACHE);
  const hit = await live.match(e.request);
  if (hit) return hit;
  const res = await fetch(e.request);
  if (res && res.ok && res.type === 'basic') e.waitUntil(live.put(e.request, res.clone()).catch(() => {}));
  return res;
}

// ---------- Google Fonts ----------
const FONT_CSS_HOST = 'fonts.googleapis.com';
const fontUrls = (css) => [...new Set([...String(css).matchAll(/url\((['"]?)(https:\/\/fonts\.gstatic\.com\/[^)'"]+)\1\)/g)].map((m) => m[2]))];

// Every font file the CSS lists, so other subsets (unicode ranges) work offline too.
async function cacheFontFiles(c, css) {
  await Promise.all(fontUrls(css).map(async (u) => {
    if (await c.match(u, { ignoreVary: true })) return;
    try {
      const res = await fetch(u, { mode: 'cors', credentials: 'omit' });
      if (res.ok) await c.put(u, res);
    } catch { /* next time */ }
  }));
}

// The cached CSS without the @font-face rules whose file is not cached: the browser
// then never asks for a file that cannot load (no console errors offline).
async function cssFromCache(c, hit) {
  const css = await hit.text();
  const blocks = css.split(/(?=@font-face)/);
  const keep = [];
  for (const b of blocks) {
    const urls = fontUrls(b);
    let ok = true;
    for (const u of urls) if (!(await c.match(u, { ignoreVary: true }))) { ok = false; break; }
    if (ok) keep.push(b);
  }
  return new Response(keep.join(''), { status: 200, headers: { 'content-type': 'text/css; charset=utf-8' } });
}

async function fontCssResponse(e) {
  const c = await caches.open(FONT_CACHE);
  const key = e.request.url;
  let hit = await c.match(key, { ignoreVary: true });
  if (hit && hit.type === 'opaque') hit = null; // stored by an older worker, unreadable
  // CORS fetch (fonts.googleapis.com allows it), so the worker can read the font list.
  const net = fetch(key, { mode: 'cors', credentials: 'omit' }).then(async (res) => {
    if (res && res.ok) {
      await c.put(key, res.clone());
      await cacheFontFiles(c, await res.clone().text());
    }
    return res;
  });
  e.waitUntil(net.catch(() => {}));
  if (hit) return cssFromCache(c, hit);
  try {
    const res = await net;
    if (res && res.ok) return res;
  } catch { /* offline */ }
  // Offline and never cached: an empty stylesheet, the system font is used.
  return new Response('', { status: 200, headers: { 'content-type': 'text/css; charset=utf-8' } });
}

async function fontFileResponse(e) {
  const c = await caches.open(FONT_CACHE);
  const hit = await c.match(e.request, { ignoreVary: true });
  if (hit) return hit; // font files have versioned URLs: never revalidated
  try {
    const res = await fetch(e.request);
    if (res && (res.ok || res.type === 'opaque')) e.waitUntil(c.put(e.request, res.clone()).catch(() => {}));
    return res;
  } catch {
    // Not reached with cssFromCache (it drops faces that are not cached). Empty font:
    // the browser falls back to the next font quietly.
    return new Response(new ArrayBuffer(0), { status: 200, headers: { 'content-type': 'font/woff2' } });
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    const isPage = req.mode === 'navigate' || /\/(index\.html)?$/.test(url.pathname);
    if (url.pathname.endsWith('/sw.js')) return; // never cache the worker itself
    e.respondWith(isPage ? pageResponse(e) : assetResponse(e));
    return;
  }

  if (url.hostname === FONT_CSS_HOST) { e.respondWith(fontCssResponse(e)); return; }
  if (url.hostname === 'fonts.gstatic.com') { e.respondWith(fontFileResponse(e)); return; }
  // Anything else (none expected) goes to the network untouched.
});
