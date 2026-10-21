// Service worker: cache-first for same-origin app files, so the game works offline.
// Bump VERSION on every release to refresh the cache.
// Privacy: nothing about audio ever passes through here. Recordings are blob URLs in page memory.
const VERSION = 'v1-2026-10-21';
const CACHE = `speaker-trainer-${VERSION}`;
const FONT_CACHE = 'speaker-trainer-fonts';

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
  './js/ui/art.js',
  './js/ui/coach.js',
  './js/ui/dom.js',
  './js/ui/fx.js',
  './js/ui/home.js',
  './js/ui/icons.js',
  './js/ui/mic.js',
  './js/ui/mission.js',
  './js/ui/onboarding.js',
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
  './js/ui/tts.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(APP_FILES.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => null))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('speaker-trainer-') && k !== CACHE && k !== FONT_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    // App shell: navigations get index.html (hash routing keeps one page).
    const key = req.mode === 'navigate' ? './index.html' : req;
    e.respondWith(
      caches.match(key, { ignoreSearch: req.mode === 'navigate' }).then((hit) => hit || fetch(req).then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match('./index.html'))),
    );
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
