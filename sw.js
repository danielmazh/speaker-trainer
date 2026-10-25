// Service worker: the game works offline, and new releases reach users fast.
// - Page loads (navigations, index.html): network first with a 3 s timeout, cache as fallback.
//   So a new index.html is used on the next open, even when VERSION was not bumped.
// - App files (JS, CSS, icons): cache first, revalidated in the background on every load.
//   When a file changed on the server, open pages get an 'ASSETS_UPDATED' message.
// - A new VERSION installs a full new cache and then waits. The page shows "גרסה חדשה מוכנה";
//   the "רענן" button posts SKIP_WAITING, and the page reloads on controllerchange.
// Bump VERSION on every release anyway: it gives a clean, complete cache for the new code.
// Privacy: nothing about audio ever passes through here. Recordings are blob URLs in page memory.
const VERSION = 'v6-2026-10-25';
const CACHE = `speaker-trainer-${VERSION}`;
const FONT_CACHE = 'speaker-trainer-fonts';
const NAV_TIMEOUT_MS = 3000;

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

// The page asks for the new version (button "רענן").
self.addEventListener('message', (e) => {
  const d = e.data;
  if (d === 'SKIP_WAITING' || (d && d.type === 'SKIP_WAITING')) self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('speaker-trainer-') && k !== CACHE && k !== FONT_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Same file, new content? Compare validators; no validator means "unknown", not "changed".
function changed(oldRes, newRes) {
  for (const h of ['etag', 'last-modified', 'content-length']) {
    const a = oldRes.headers.get(h), b = newRes.headers.get(h);
    if (a && b) return a !== b;
  }
  return false;
}

let notified = false;
function notifyUpdate() {
  if (notified) return;
  notified = true;
  self.clients.matchAll({ type: 'window' }).then((list) => list.forEach((c) => c.postMessage({ type: 'ASSETS_UPDATED' })));
}

// Network first for the page itself. Falls back to the cached shell after NAV_TIMEOUT_MS or offline.
function pageResponse(e) {
  const cached = caches.match('./index.html');
  const net = fetch(e.request);
  // Registered first, so the clone happens before anyone reads the body.
  e.waitUntil(net.then((res) => {
    if (!(res && res.ok && res.type === 'basic')) return undefined;
    const copy = res.clone();
    return caches.open(CACHE).then((c) => c.put('./index.html', copy));
  }).catch(() => {}));
  const timeout = new Promise((resolve) => setTimeout(resolve, NAV_TIMEOUT_MS));
  return Promise.race([net.catch(() => null), timeout.then(() => null)]).then(async (res) => {
    if (res) return res;
    const hit = await cached;
    if (hit) return hit;
    return net; // nothing cached yet: wait for the network (or fail like the browser would)
  });
}

// Cache first, then refresh the cached copy in the background.
function assetResponse(e) {
  const req = e.request;
  const cacheP = caches.open(CACHE);
  const hitP = cacheP.then((c) => c.match(req)).catch(() => undefined);
  const netP = hitP.then((hit) => fetch(req).then((res) => {
    if (res && res.ok && res.type === 'basic') {
      if (hit && changed(hit, res)) notifyUpdate();
      const copy = res.clone();
      // Allowed here: the waitUntil(netP) below is still pending.
      e.waitUntil(cacheP.then((c) => c.put(req, copy)).catch(() => {}));
    }
    return res;
  }));
  e.waitUntil(netP.catch(() => {}));
  return hitP.then((hit) => hit || netP);
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

  // Google Fonts: stale-while-revalidate, so text looks right offline.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(FONT_CACHE).then((c) => c.match(req).then((hit) => {
        const net = fetch(req).then((res) => { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || net;
      })),
    );
  }
  // Anything else (none expected) goes to the network untouched.
});
