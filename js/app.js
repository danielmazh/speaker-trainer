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
import { profileOf } from './ui/shell.js';


const ROUTES = {
  onboarding: { mod: onboarding, nav: false },
  home: { mod: home, nav: true },
  mission: { mod: mission, nav: true },
  play: { mod: play, nav: false },
  coach: { mod: coach, nav: true },
  path: { mod: pathScreen, nav: true },
  track: { mod: trackScreen, nav: true },
  stats: { mod: statsScreen, nav: true },
  profile: { mod: profile, nav: true },
};

const NAV = [
  { r: 'home', label: 'בית', ic: 'home' },
  { r: 'path', label: 'המסלול', ic: 'map' },
  { r: 'play', label: 'שחק', ic: 'play', center: true },
  { r: 'stats', label: 'התקדמות', ic: 'chart' },
  { r: 'profile', label: 'פרופיל', ic: 'user' },
];

try { E.configure({ ITEMS: C.ITEMS, BADGES: C.BADGES, LEVEL_TITLES_HE: C.LEVEL_TITLES_HE, TRACKS: C.TRACKS }); } catch { /* engine falls back to content itself */ }

const store = E.createStore();
if (typeof E.ensureIdentity === 'function') store.set((st) => E.ensureIdentity(st, Date.now()));
const itemMap = new Map((C.ITEMS || []).map((it) => [it.id, it]));
const catMap = new Map((C.CATEGORIES || []).map((c) => [c.id, c]));
const TRACKS = buildTracks();
let cleanups = [];
let current = null;

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
  go(route) {
    const h = `#${route}`;
    if (location.hash === h) render();
    else location.hash = h;
  },
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
    ctx.session.task = task;
    ctx.go('play');
  },
  // Free practice outside the daily mission (from skill cards and coach).
  startPractice({ title_he, itemIds, kind = 'practice' }) {
    const ids = (itemIds || []).filter((id) => itemMap.has(id));
    if (!ids.length) { fx.toast('אין עדיין תרגילים כאן.', { kind: 'warn' }); return; }
    ctx.session.task = { id: `practice:${Date.now()}`, kind, title_he, itemIds: ids, xp: 0, practice: true };
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
      out = E.completeTask(before, task.id, results, Date.now(), { items: C.ITEMS, badges: C.BADGES });
    }
    store.set(() => out.state);
    const after = store.get();
    // Unit news (result.js does not know about units): a short toast after the score shows.
    if (task.unit && (out.unitDone || out.bossPassed)) {
      setTimeout(() => fx.toast(out.unitDone ? 'פתחת את היחידה הבאה במסלול.' : 'ניצחת את הבוס של היחידה.', { kind: 'badge', title: out.unitDone ? 'יחידה הושלמה!' : 'בוס הובס!', iconName: out.unitDone ? 'trophy' : 'crown', ms: 3800 }), 2200);
    }
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
        fx.toast(b.desc_he, { kind: 'badge', title: `תג חדש: ${b.title_he}`, iconName: b.icon || 'medal', ms: 4200 });
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

function routeName() {
  const h = (location.hash || '').replace(/^#/, '');
  return ROUTES[h] ? h : null;
}

function renderNav(name) {
  const nav = document.getElementById('nav');
  const show = ROUTES[name]?.nav;
  nav.hidden = !show;
  if (!show) return;
  if (!nav.dataset.ready) {
    nav.innerHTML = NAV.map((n) => n.center
      ? `<span class="slot-center"><a href="#play" class="center" data-r="play" aria-label="שחק: המשימה של היום"><span class="pulse" aria-hidden="true"></span><span class="core">${icon(n.ic)}</span></a></span>`
      : `<a href="#${n.r}" data-r="${n.r}" aria-label="${esc(n.label)}">${icon(n.ic)}</a>`).join('');
    nav.dataset.ready = '1';
    nav.querySelector('.center').addEventListener('click', (e) => {
      e.preventDefault();
      fx.haptic(10);
      const t = ctx.nextTask();
      if (t) ctx.startTask(t);
      else ctx.go('mission');
    });
    nav.querySelector('.center').title = 'המשימה של היום';
  }
  const active = name === 'mission' ? 'home' : name === 'coach' || name === 'track' ? 'path' : name;
  nav.querySelectorAll('a').forEach((a) => {
    if (a.dataset.r === active) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  const pulse = nav.querySelector('.pulse');
  if (pulse) pulse.hidden = !ctx.nextTask();
}

function render() {
  for (const fn of cleanups.splice(0)) { try { fn(); } catch { /* ignore */ } }
  ensureToday();
  let name = routeName();
  const st = store.get();
  if (!st.onboarded && name !== 'onboarding') { location.replace('#onboarding'); name = 'onboarding'; }
  if (!name) { location.replace('#home'); name = 'home'; }
  if (name === 'onboarding' && st.onboarded && current === null && location.hash !== '#onboarding') name = 'home';
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
}

window.addEventListener('hashchange', render);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && store.get().daily.date !== E.todayStr() && current !== 'play') render();
});

applyTheme();
render();

// ---------- service worker ----------
if ('serviceWorker' in navigator && !/[?&]nosw\b/.test(location.search)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
  });
}
