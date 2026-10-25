// Speaker Trainer - app shell: boot, state, router, shared context.
import * as C from './content.js';
import * as E from './engine.js';
import * as S from './speech.js';
import * as A from './analyze.js';
import * as D from './data.js';
import { icon } from './ui/icons.js';
import { esc } from './ui/dom.js';
import * as fx from './ui/fx.js';

import * as onboarding from './ui/onboarding.js';
import * as home from './ui/home.js';
import * as mission from './ui/mission.js';
import * as play from './ui/play.js';
import * as coach from './ui/coach.js';
import * as statsScreen from './ui/stats.js';
import * as profile from './ui/profile.js';
import * as pathScreen from './ui/path.js';
import * as trackScreen from './ui/track.js';
import { profileOf, navHtml, navActive } from './ui/shell.js';

// Fonts: index.html preloads the Google Fonts CSS; switch it on here (no inline handler under the CSP).
(() => {
  const l = document.getElementById('font-css');
  if (l && l.rel !== 'stylesheet') l.rel = 'stylesheet';
})();

const ROUTES = {
  onboarding: { mod: onboarding, nav: false },
  home: { mod: home, nav: true },
  mission: { mod: mission, nav: false },
  play: { mod: play, nav: false },
  coach: { mod: coach, nav: true },
  path: { mod: pathScreen, nav: true },
  // 2026-10-25: no nav on Track (like Mission): its sticky "התחל יחידה" sat right above
  // the nav "אימון" button, which starts the daily mission instead. Track has a back arrow.
  track: { mod: trackScreen, nav: false },
  stats: { mod: statsScreen, nav: true },
  profile: { mod: profile, nav: true },
};

// Top-level tabs: switching between them replaces the history entry (no pile-up).
// Everything else (mission, play, track, coach) pushes, so Back returns to where you were.
const TABS = new Set(['home', 'path', 'stats', 'profile']);

// sessionStorage: survives a reload of this tab, never shared, never sent anywhere.
const SS_TASK = 'speakerTrainer.ui.task'; // the session on #play (resume after reload)
const SS_LAST = 'speakerTrainer.ui.lastDone'; // where a finished or left session returns to
const ss = {
  get(k) { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch { return null; } },
  set(k, v) { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};
// Task descriptor only: ids and flags, never results, transcripts or audio.
function taskDescriptor(t) {
  if (!t || typeof t.id !== 'string') return null;
  const keep = ['id', 'kind', 'title_he', 'itemIds', 'xp', 'minutes', 'practice', 'unit', 'trackId', 'unitId', 'bossId', 'back'];
  const out = {};
  for (const k of keep) if (t[k] !== undefined) out[k] = t[k];
  return out;
}
const backOf = (t) => (t && (t.unit || t.back === 'track') ? 'track' : t && t.practice ? 'home' : 'mission');

try { E.configure({ ITEMS: C.ITEMS, BADGES: C.BADGES, LEVEL_TITLES_HE: C.LEVEL_TITLES_HE, TRACKS: C.TRACKS }); } catch { /* engine falls back to content itself */ }

const store = E.createStore();
if (typeof E.ensureIdentity === 'function') store.set((st) => E.ensureIdentity(st, Date.now()));
const itemMap = new Map((C.ITEMS || []).map((it) => [it.id, it]));
const catMap = new Map((C.CATEGORIES || []).map((c) => [c.id, c]));
const TRACKS = buildTracks();
let cleanups = [];
let current = null;
let playing = null; // the task shown on #play in this render
let leaveGuard = null; // set by a screen: () => Promise<boolean>
let updateTap = null; // pending app update offer: () => void (applies the update)
let updateToast = null; // the visible update toast, if any

function ensureToday() {
  const cur = store.get();
  if (cur.daily.date === E.todayStr() && cur.daily.tasks.length) return;
  store.set(() => E.ensureDaily(cur, C.ITEMS, E.todayStr()));
}

function applyTheme() {
  const t = store.get().settings.theme;
  const root = document.documentElement;
  if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t);
  else root.removeAttribute('data-theme');
}

const ctx = {
  C, E, S, A, store,
  get state() { return store.get(); },
  set(p) { const s = store.set(p); applyTheme(); return s; },
  session: { task: null },
  item: (id) => itemMap.get(id) || null,
  cat: (id) => catMap.get(id) || null,
  level: () => E.levelFromXp(store.get().xp, C.LEVEL_TITLES_HE),
  // go(route, { replace, force }): push by default, replace between tabs; force skips the leave guard.
  go(route, opts = {}) { return navigate(route, opts); },
  // A screen with unsaved work sets fn: () => Promise<boolean> (true = leave). Cleared on every route change.
  setLeaveGuard(fn) { leaveGuard = typeof fn === 'function' ? fn : null; syncUpdateOffer(); },
  onLeave(fn) { cleanups.push(fn); },
  toast: fx.toast,
  haptic: fx.haptic,
  sound: fx.sound,
  modal: fx.modal,
  confirm: fx.confirmBox,
  confetti: fx.confetti,

  nextTask() {
    const d = store.get().daily;
    return (d.tasks || []).find((t) => !d.done.includes(t.id)) || null;
  },
  startTask(task) {
    ensureToday();
    let t = task;
    // Past midnight the old mission is gone: start today's next step instead.
    if (t && !t.practice) {
      const d = store.get().daily;
      if (!(d.tasks || []).some((x) => x.id === t.id)) {
        const n = ctx.nextTask();
        if (n) { t = n; fx.toast('יום חדש, משימה חדשה.', { kind: 'info' }); }
      }
    }
    ctx.session.task = t;
    ss.set(SS_TASK, taskDescriptor(t));
    ctx.go('play');
  },
  // Free practice outside the daily mission (from skill cards and coach).
  startPractice({ title_he, itemIds, kind = 'practice' }) {
    const ids = (itemIds || []).filter((id) => itemMap.has(id));
    if (!ids.length) { fx.toast('אין עדיין תרגילים כאן.', { kind: 'warn' }); return; }
    ctx.session.task = { id: `practice:${Date.now()}`, kind, title_he, itemIds: ids, xp: 0, practice: true };
    ss.set(SS_TASK, taskDescriptor(ctx.session.task));
    ctx.go('play');
  },
  // Pick up to n items of a category: due and weak first, then new.
  pickForCat(catId, n = 4, types = null) {
    const st = store.get().items;
    const now = Date.now();
    const pool = (C.ITEMS || []).filter((it) => it.cat === catId && (!types || types.includes(it.type)));
    const rank = (it) => {
      const s = st[it.id];
      if (!s) return 1 + Math.random();
      if (s.due <= now) return 0 + Math.random() * 0.5;
      return 2 + (s.interval || 0) / 30 + Math.random() * 0.5;
    };
    return pool.map((it) => [rank(it), it]).sort((a, b) => a[0] - b[0]).slice(0, n).map((x) => x[1].id);
  },

  // Save results. Returns { xpGained, newBadges, streakUp, levelUp, missionDone }.
  finishTask(task, results) {
    const before = store.get();
    const lvBefore = E.levelFromXp(before.xp, C.LEVEL_TITLES_HE).level;
    let out;
    if (task.practice) {
      out = E.completePractice(before, task.id, results, Date.now(), { items: C.ITEMS, badges: C.BADGES, tracks: TRACKS });
    } else {
      out = E.completeTask(before, task.id, results, Date.now(), { items: C.ITEMS, badges: C.BADGES, task });
    }
    store.set(() => out.state);
    // Done: a reload or Forward now goes back to the map or track, never into a new task.
    ss.set(SS_TASK, null);
    ss.set(SS_LAST, { back: backOf(task) });
    const after = store.get();
    // 2026-10-25: unit-done toast removed, result.js shows the unit card itself.
    const lv = E.levelFromXp(after.xp, C.LEVEL_TITLES_HE);
    const missionDone = !task.practice && after.daily.bonus && !before.daily.bonus;
    return {
      xpGained: out.xpGained || 0,
      newBadges: out.newBadges || [],
      streakUp: !!out.streakUp,
      levelUp: lv.level > lvBefore ? lv : null,
      missionDone,
      unitDone: !!out.unitDone,
      bossPassed: !!out.bossPassed,
    };
  },

  announceBadges(ids) {
    ids.forEach((id, k) => {
      const b = (C.BADGES || []).find((x) => x.id === id);
      if (!b) return;
      setTimeout(() => {
        fx.toast(b.desc_he, { kind: 'badge', title: `תג חדש: ${b.title_he}`, iconName: b.icon || 'medal', ms: 2500 });
        fx.haptic([20, 40, 20]);
      }, 600 + k * 900);
    });
  },
  levelUpModal: fx.levelUpModal,

  // ---------- phase 3: tracks, profile, stats, data ----------
  tracks: () => TRACKS,
  track: (id) => TRACKS.find((t) => t.id === id) || null,
  trackProgress: () => E.trackProgress(store.get(), TRACKS, C.ITEMS),
  // Start one unit of a track: the normal players run its items, then the boss.
  startUnit(track, unit) {
    const st = store.get();
    const sess = E.buildUnitSession(st, unit, C.ITEMS); // itemIds with the boss last
    const play = (sess.itemIds || []).filter((id) => itemMap.has(id));
    if (!play.length) { fx.toast('היחידה הזאת עוד ריקה.', { kind: 'warn' }); return; }
    ctx.session.task = { ...sess, kind: 'unit', itemIds: play, practice: true, unit: true, trackId: track.id, unitId: unit.id, back: 'track' };
    ctx.session.lastUnit = { trackId: track.id, unitId: unit.id };
    ss.set(SS_TASK, taskDescriptor(ctx.session.task));
    ctx.go('play');
  },
  profile: () => profileOf(store.get()),
  saveProfile(patch) {
    const p = { ...profileOf(store.get()), ...patch };
    const s = ctx.set({ profile: p, ...(p.name ? { name: p.name } : {}) });
    return s;
  },
  stats: () => E.stats(store.get(), C.ITEMS, TRACKS, Date.now()),
  exportData: () => D.exportData(store.get()),
  // Throws Error with a Hebrew message when the text is not valid. State is unchanged then.
  importData(text) {
    const next = D.importData(text, { now: Date.now(), items: C.ITEMS, badges: C.BADGES, tracks: C.TRACKS || [] });
    store.set(() => next);
    applyTheme();
    return store.get();
  },
};

// ---------- phase 3: TRACKS fallback until content.js lands them ----------

// TRACKS from content, or one track per category built from its items.
function buildTracks() {
  if (Array.isArray(C.TRACKS) && C.TRACKS.length) return C.TRACKS;
  const out = [];
  for (const c of C.CATEGORIES || []) {
    const list = (C.ITEMS || []).filter((it) => it.cat === c.id);
    if (list.length < 3) continue;
    const bosses = list.filter((it) => ['speak', 'qa', 'recall'].includes(it.type));
    let rest = list.filter((it) => !bosses.includes(it));
    if (rest.length < 3) rest = list;
    const units = [];
    const size = 5;
    const n = Math.max(1, Math.min(5, Math.ceil(rest.length / size)));
    for (let k = 0; k < n; k++) {
      const chunk = rest.slice(k * size, k * size + size).map((it) => it.id);
      const boss = bosses[k % Math.max(1, bosses.length)] || list[list.length - 1];
      if (!chunk.length) break;
      units.push({ id: `${c.id}-u${k + 1}`, title_he: `${c.label_he} ${k + 1}`, goal_he: c.desc_he || '', itemIds: chunk, bossId: boss.id });
    }
    if (units.length) out.push({ id: `t-${c.id}`, title_he: c.label_he, desc_he: c.desc_he || '', icon: c.icon || c.id, color: c.color, units, fallback: true });
  }
  return out;
}

fx.bindSettings(() => store.get().settings);

// ---------- router ----------
// Bare-hash routes. Every history entry carries { idx, prev } in history.state:
// idx = position in this tab's history, prev = the route of the entry before it.
// Internal moves use pushState/replaceState and render directly; Back, Forward and
// typed hashes arrive as hashchange.

let navIdx = 0;
let bypass = 0; // hashchange events we caused ourselves (history.back after a guard said yes)

function routeName() {
  const h = (location.hash || '').replace(/^#/, '');
  return ROUTES[h] ? h : null;
}

// history.state without the `modal` marker that js/ui/fx.js puts on a dialog's entry.
function baseState() {
  const { modal: _m, ...rest } = history.state || {};
  return rest;
}

function stamp(extra = {}) {
  try { history.replaceState({ ...baseState(), idx: navIdx, ...extra }, ''); } catch { /* ignore */ }
}

// Replace the current entry's hash without a hashchange event.
function replaceHash(route) {
  try { history.replaceState({ ...baseState(), idx: navIdx }, '', `#${route}`); } catch { location.replace(`#${route}`); }
}

function renderNav(name) {
  const nav = document.getElementById('nav');
  const show = ROUTES[name]?.nav;
  nav.hidden = !show;
  if (!show) return;
  // 2026-10-25: nav styles moved to css/components.css, no runtime injection.
  if (!nav.dataset.ready) {
    nav.innerHTML = navHtml();
    nav.dataset.ready = '1';
    nav.querySelector('.center').addEventListener('click', (e) => {
      e.preventDefault();
      fx.haptic(10);
      const t = ctx.nextTask();
      if (t) ctx.startTask(t);
      else ctx.go('mission');
    });
  }
  const active = navActive(name);
  nav.querySelectorAll('a').forEach((a) => {
    if (a.dataset.r === active) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  const pulse = nav.querySelector('.pulse');
  if (pulse) pulse.hidden = !ctx.nextTask();
}

async function askLeave() {
  const fn = leaveGuard;
  if (!fn) return true;
  try { return !!(await fn()); } catch { return true; }
}

// Move to a route. Tabs replace each other; a move back to the previous entry's route
// reuses that entry (history.back), so Back never walks through screens twice.
async function navigate(route, { replace, force = false } = {}) {
  if (!ROUTES[route]) route = 'home';
  if (!force && leaveGuard && route !== current) {
    if (!(await askLeave())) return;
  }
  leaveGuard = null;
  const h = `#${route}`;
  if (location.hash === h) { render(); return; }
  let rep = replace ?? ((TABS.has(current) && TABS.has(route)) || current === 'onboarding' || current === null);
  const raw = history.state || {};
  // A sheet or modal (js/ui/fx.js) is open on its own same-hash entry: that entry is
  // reused for the move, so no dead entry is left behind for Back.
  const overModal = !!raw.modal;
  const st = baseState();
  if (!rep && navIdx > 0 && st.prev === route && st.idx === navIdx) {
    bypass++;
    if (overModal) history.go(-2); // over the dialog entry and the screen entry
    else history.back();
    return;
  }
  if (overModal && !rep) {
    // Replace the dialog entry with the new screen; it sits right after the screen entry.
    navIdx = (typeof st.idx === 'number' ? st.idx : navIdx) + 1;
    history.replaceState({ idx: navIdx, prev: current }, '', h);
    render();
    return;
  }
  if (rep) {
    history.replaceState({ ...st, idx: navIdx }, '', h);
  } else {
    const prev = current;
    navIdx += 1;
    history.pushState({ idx: navIdx, prev }, '', h);
  }
  render();
}

// Back, Forward, a typed hash, or a link we did not catch.
async function onHashChange() {
  const st = history.state;
  const known = st && typeof st.idx === 'number';
  if (bypass > 0) {
    bypass--;
    if (known) navIdx = st.idx;
    render();
    return;
  }
  const target = routeName() || 'home';
  if (leaveGuard && current && target !== current) {
    // Put the screen's hash back at once (no render), then ask.
    if (known) {
      navIdx = st.idx + 1;
      history.pushState({ idx: navIdx, prev: target }, '', `#${current}`);
      if (await askLeave()) { leaveGuard = null; bypass++; history.back(); }
    } else {
      // An entry with no state (typed URL, or an entry from before this version). Its
      // real predecessor is unknown, so prev stays null: a later move never treats it
      // as "go back" (2026-10-25, audit 2 P2-D).
      navIdx += 1;
      history.replaceState({ idx: navIdx, prev: null }, '', `#${current}`);
      if (await askLeave()) {
        leaveGuard = null;
        history.replaceState({ idx: navIdx, prev: null }, '', `#${target}`);
        render();
      }
    }
    return;
  }
  if (known) navIdx = st.idx;
  else { navIdx += 1; stamp({ prev: null }); }
  render();
}

// Onboarding: js/ui/onboarding.js pushes its own same-hash entries for the questions
// ({ obq }) and handles them on popstate. The slides are added here ({ obs: slide }),
// so Back on slide 3 shows slide 2 instead of leaving the app.
const obSlideNow = () => {
  const dots = [...document.querySelectorAll('#view .onboarding:not(.questions) .dots i')];
  return dots.length ? Math.max(0, dots.findIndex((d) => d.classList.contains('on'))) : -1;
};
const obSlideKey = (key) => {
  const track = document.querySelector('#view .ob-track');
  if (track) track.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
};
// Capture phase: runs before onboarding.js moves the slide, so the current slide is still known.
document.getElementById('view').addEventListener('click', (e) => {
  if (current !== 'onboarding' || !e.target.closest('[data-next]')) return;
  const cur = obSlideNow();
  const last = document.querySelectorAll('#view .ob-slide').length - 1;
  if (cur < 0 || cur >= last) return; // last slide: onboarding.js pushes the first question
  navIdx += 1;
  history.pushState({ idx: navIdx, prev: 'onboarding', obs: cur + 1 }, '', '#onboarding');
}, true);
window.addEventListener('popstate', (e) => {
  if (current !== 'onboarding' || routeName() !== 'onboarding') return;
  const st = e.state || {};
  if (typeof st.idx === 'number') navIdx = st.idx;
  if (typeof st.obq === 'number') return;
  const want = Number(st.obs) || 0;
  // After onboarding.js has drawn the slides again.
  setTimeout(() => {
    let cur = obSlideNow();
    for (let i = 0; i < 4 && cur >= 0 && cur !== want; i++) {
      obSlideKey(cur < want ? 'ArrowLeft' : 'ArrowRight');
      cur = obSlideNow();
    }
  }, 0);
});

// ---------- render ----------

// Resolve what #play shows: the live session, a saved one (reload), or not a stale replay.
function resolvePlay() {
  if (ctx.session.task) return 'play';
  const saved = ss.get(SS_TASK);
  if (saved && saved.id && Array.isArray(saved.itemIds)) {
    let t = saved;
    if (!t.practice && !store.get().daily.tasks.some((x) => x.id === t.id)) t = ctx.nextTask() || t; // reload after midnight
    ctx.session.task = t;
    if (t.trackId) ctx.session.trackId = t.trackId;
    return 'play';
  }
  // No session: Forward after a result, or a reload on the result screen.
  const last = ss.get(SS_LAST);
  if (last && ROUTES[last.back] && last.back !== 'play') return last.back;
  return 'play'; // a fresh open of #play (shortcut): play.js starts the next step
}

function render() {
  ensureToday();
  let name = routeName();
  const st = store.get();
  if (!st.onboarded && name !== 'onboarding') { replaceHash('onboarding'); name = 'onboarding'; }
  if (!name) { replaceHash('home'); name = 'home'; }
  if (name === 'onboarding' && st.onboarded) { replaceHash('home'); name = 'home'; }
  if (name === 'play') {
    const to = resolvePlay();
    if (to !== 'play') {
      // Forward onto a finished step: the entry before is already that screen, so step
      // back to it instead of making a second copy of it (2026-10-25, audit 2 P2-E).
      const hs = baseState();
      if (hs.prev === to && navIdx > 0 && hs.idx === navIdx) { bypass++; history.back(); return; }
      replaceHash(to);
      name = to;
    }
  }
  renderRoute(name);
}

function renderRoute(name) {
  for (const fn of cleanups.splice(0)) { try { fn(); } catch { /* ignore */ } }
  fx.closeAll();
  leaveGuard = null;
  ensureToday();
  // Leaving #play without finishing: the session is over, a reload must not restart it.
  if (current === 'play' && name !== 'play' && playing) {
    ss.set(SS_TASK, null);
    ss.set(SS_LAST, { back: backOf(playing) });
  }
  playing = name === 'play' ? ctx.session.task || null : null;
  current = name;
  const view = document.getElementById('view');
  view.innerHTML = '';
  // Fresh host per render: screens bind delegated listeners on their root, so a new
  // element keeps old listeners from piling up on #view across visits.
  const root = document.createElement('div');
  root.className = 'view-host';
  view.appendChild(root);
  window.scrollTo(0, 0);
  renderNav(name);
  try {
    ROUTES[name].mod.render(root, ctx);
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="wrap" style="padding-top:60px"><div class="card stack"><h2>אופס, משהו נשבר</h2><p class="muted small">${esc(err && err.message)}</p><a class="btn" href="#home">חזרה הביתה</a></div></div>`;
  }
  const h = root.querySelector('h1');
  if (h) { h.setAttribute('tabindex', '-1'); try { h.focus({ preventScroll: true }); } catch { /* ignore */ } }
  syncUpdateOffer();
}

// In-app links: route through navigate() so tabs replace and deeper screens push.
document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest && e.target.closest('a[href^="#"]');
  if (!a || a.target) return;
  const r = a.getAttribute('href').slice(1);
  if (!ROUTES[r]) return; // e.g. the skip link to #view
  e.preventDefault();
  ctx.go(r);
});

window.addEventListener('hashchange', onHashChange);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && store.get().daily.date !== E.todayStr() && current !== 'play') render();
});

{
  const st = history.state;
  if (st && typeof st.idx === 'number') navIdx = st.idx;
  else stamp({ prev: null });
}
applyTheme();
render();
// Reloaded on a dialog's entry (the dialog is gone): step back to the screen's own entry.
if (history.state && history.state.modal) { try { history.back(); } catch { /* ignore */ } }

// ---------- service worker: register on time, offer updates ----------
// The update toast never shows during a task: while #play is on screen (task or its
// result) or a leave guard is set, the offer waits and shows on the next screen.
// "רענן" asks the leave guard first, so it never drops answers silently.
function busyForUpdate() { return current === 'play' || current === 'onboarding' || !!leaveGuard; }
function syncUpdateOffer() {
  if (!updateTap) return;
  if (busyForUpdate()) {
    if (updateToast) { updateToast.close(); updateToast = null; }
    return;
  }
  if (updateToast && !updateToast.closed) return;
  const tap = updateTap;
  updateToast = fx.actionToast('לחץ כדי לטעון אותה עכשיו.', {
    title: 'גרסה חדשה מוכנה', label: 'רענן', iconName: 'sparkles',
    onClick: async () => {
      updateToast = null;
      if (leaveGuard && !(await askLeave())) { syncUpdateOffer(); return; }
      leaveGuard = null;
      updateTap = null;
      tap();
    },
  });
}

function setupServiceWorker() {
  if (!('serviceWorker' in navigator) || /[?&]nosw\b/.test(location.search)) return;
  const sw = navigator.serviceWorker;
  let wantReload = false;
  const offer = (onTap) => { updateTap = onTap; syncUpdateOffer(); };
  // A new worker finished installing and waits: ask before switching.
  const offerWaiting = (reg) => {
    const w = reg.waiting;
    if (!w || !sw.controller) return;
    offer(() => { wantReload = true; w.postMessage({ type: 'SKIP_WAITING' }); });
  };
  sw.addEventListener('controllerchange', () => {
    if (!wantReload) return;
    wantReload = false;
    location.reload();
  });
  // Same worker, newer app files on the server: sw.js has fetched the whole new set into
  // a staging cache. A reload switches to it as one unit (sw.js promotes it on navigation).
  sw.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'ASSETS_UPDATED') offer(() => location.reload());
  });
  const askWorker = () => { try { sw.controller && sw.controller.postMessage({ type: 'CHECK_UPDATE' }); } catch { /* ignore */ } };
  const register = () => sw.register('sw.js').then((reg) => {
    offerWaiting(reg);
    askWorker();
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      if (nw) nw.addEventListener('statechange', () => { if (nw.state === 'installed') offerWaiting(reg); });
    });
    const check = () => { reg.update().catch(() => { /* offline */ }); askWorker(); };
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    setInterval(check, 30 * 60 * 1000);
  }).catch(() => { /* offline support is optional */ });
  // The module graph may finish after 'load' already fired: register at once then.
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
setupServiceWorker();
