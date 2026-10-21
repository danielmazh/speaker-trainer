// Speaker Trainer - game engine.
// Pure functions. Storage is injected. Content (ITEMS, BADGES, LEVEL_TITLES_HE)
// can be passed as parameters; when it is not, the engine falls back to
// js/content.js, loaded lazily and safely (a missing or broken file is ignored).

export const STORE_KEY = 'speakerTrainer.v1';
export const DAY_MS = 24 * 60 * 60 * 1000;
export const HISTORY_CAP = 500;
export const MISSION_BONUS_XP = 50;
export const TASK_XP = { warmup: 20, fix: 30, choice: 30, speak: 50, boss: 70 };
export const TASK_MINUTES = { warmup: 2, fix: 3, choice: 2, speak: 3, boss: 2 };
export const SCHEMA = 2;
export const APP_VERSION = '3.0.0';
export const PASS_SCORE = 70; // unit item and boss pass mark
export const PRACTICE_ITEM_XP = 5; // per item with score >= 60
export const BOSS_PASS_XP = 40; // first boss pass in a unit
export const UNIT_DONE_XP = 60; // once per unit
// Estimated minutes per item when no durationSec was measured.
export const MINUTES_BY_TYPE = { shadow: 0.3, fix: 0.5, choice: 0.3, speak: 1, recall: 1, qa: 1 };
const KIND_TO_TYPE = { warmup: 'shadow', fix: 'fix', choice: 'choice', speak: 'speak', boss: 'qa' };

// ---------- content fallback ----------

let CONTENT = {};
try {
  CONTENT = await import('./content.js');
} catch {
  CONTENT = {};
}

// Lets the app (or tests) set content explicitly. Any key left out keeps its current value.
export function configure({ ITEMS, BADGES, LEVEL_TITLES_HE, TRACKS } = {}) {
  CONTENT = { ...CONTENT };
  if (ITEMS) CONTENT.ITEMS = ITEMS;
  if (TRACKS) CONTENT.TRACKS = TRACKS;
  if (BADGES) CONTENT.BADGES = BADGES;
  if (LEVEL_TITLES_HE) CONTENT.LEVEL_TITLES_HE = LEVEL_TITLES_HE;
}

function contentItems(items) {
  return Array.isArray(items) ? items : Array.isArray(CONTENT.ITEMS) ? CONTENT.ITEMS : [];
}
function contentBadges(badges) {
  return Array.isArray(badges) ? badges : Array.isArray(CONTENT.BADGES) ? CONTENT.BADGES : [];
}
function contentTracks(tracks) {
  return Array.isArray(tracks) ? tracks : Array.isArray(CONTENT.TRACKS) ? CONTENT.TRACKS : [];
}
function contentTitles(titles) {
  return Array.isArray(titles) ? titles : Array.isArray(CONTENT.LEVEL_TITLES_HE) ? CONTENT.LEVEL_TITLES_HE : [];
}

// ---------- dates and random ----------

const pad = (n) => String(n).padStart(2, '0');

export function todayStr(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDateStr(dateStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  return { y, m, d };
}

// Local Date at 00:00 of dateStr.
function startOfDay(dateStr) {
  const { y, m, d } = parseDateStr(dateStr);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

// Epoch ms of the last moment of dateStr (local).
export function endOfDay(dateStr) {
  const { y, m, d } = parseDateStr(dateStr);
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
}

// Shift a 'YYYY-MM-DD' by n calendar days (local, DST safe).
export function addDays(dateStr, n) {
  const { y, m, d } = parseDateStr(dateStr);
  return todayStr(new Date(y, m - 1, d + n, 12));
}

// Whole calendar days from a to b (b - a).
export function dayDiff(a, b) {
  const pa = parseDateStr(a);
  const pb = parseDateStr(b);
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / DAY_MS);
}

// mulberry32 seeded by a string hash (xmur3).
export function seededRandom(seedString) {
  const str = String(seedString);
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  let a = (h ^= h >>> 16) >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- state ----------

// Fresh v2 state. Identity fields (profile.id, createdAt) stay null here so the
// result is deterministic; ensureIdentity() fills them on first save or import.
export function defaultState() {
  return {
    v: SCHEMA,
    name: '',
    onboarded: false,
    xp: 0,
    streak: { count: 0, last: null, best: 0 },
    days: [],
    items: {},
    history: [],
    badges: [],
    settings: { onDevice: 'auto', haptics: true, sound: true, theme: 'system' },
    daily: { date: null, tasks: [], done: [], bonus: false },
    missions: 0,
    counters: { fillerFree: 0, perfect: 0, boss: 0, graded: 0, mic: 0, nightOwl: 0, earlyBird: 0, words: 0, minutes: 0, cats: {} },
    profile: {
      id: null,
      name: '',
      role: '',
      nativeLang: 'he',
      goals: [],
      focusTracks: [],
      dailyGoalMin: 10,
      nextTalkDate: null,
      audiences: [],
      createdAt: null,
    },
    meta: { schema: SCHEMA, createdAt: null, updatedAt: null, appVersion: APP_VERSION },
    tracks: {},
  };
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
export const isSafeKey = (k) => typeof k === 'string' && !UNSAFE_KEYS.has(k);

// Merge saved over defaults. Types of known keys are kept; unknown keys survive.
export function deepMerge(defaults, saved) {
  if (saved === undefined) return clone(defaults);
  if (isPlainObject(defaults)) {
    if (!isPlainObject(saved)) return clone(defaults);
    const out = {};
    for (const k of Object.keys(defaults)) out[k] = deepMerge(defaults[k], saved[k]);
    for (const k of Object.keys(saved)) if (!(k in defaults) && isSafeKey(k)) out[k] = clone(saved[k]);
    return out;
  }
  if (Array.isArray(defaults)) return Array.isArray(saved) ? clone(saved) : clone(defaults);
  if (defaults === null) return saved === undefined ? null : clone(saved);
  if (typeof defaults === typeof saved) return saved;
  return defaults;
}

function clone(v) {
  return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
}

// ---------- ids ----------

// RFC 4122 version 4 uuid. Uses crypto.randomUUID, then getRandomValues, then Math.random.
export function uuidv4() {
  const c = globalThis.crypto;
  try {
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  } catch {
    /* fall through */
  }
  const b = new Uint8Array(16);
  let filled = false;
  try {
    if (c && typeof c.getRandomValues === 'function') {
      c.getRandomValues(b);
      filled = true;
    }
  } catch {
    filled = false;
  }
  if (!filled) for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ---------- schema migration ----------

const histType = (e, itemsById) => e.itemType || itemsById.get(e.itemId)?.type || KIND_TO_TYPE[e.taskKind] || null;

// Minutes spent on one history entry: measured durationSec, else an estimate by item kind.
export function entryMinutes(e, itemsById = new Map()) {
  const m = isPlainObject(e?.metrics) ? e.metrics : {};
  const d = Number(m.durationSec);
  if (Number.isFinite(d) && d > 0) return Math.min(d, 1800) / 60;
  const type = histType(e || {}, itemsById);
  if (type === 'speak') {
    const sec = Number(itemsById.get(e.itemId)?.seconds);
    return Number.isFinite(sec) && sec > 0 ? sec / 60 : 1;
  }
  return MINUTES_BY_TYPE[type] ?? 0.5;
}

// Upgrade any older saved shape to the current schema. Keeps all old data.
// Pure: no ids or timestamps are invented here (see ensureIdentity).
export function migrate(state, ITEMS) {
  const raw = isPlainObject(state) ? state : {};
  const fromV = Number(raw.v) || (Object.keys(raw).length ? 1 : SCHEMA);
  const s = deepMerge(defaultState(), raw);
  if (fromV < 2) {
    const itemsById = new Map(contentItems(ITEMS).map((it) => [it.id, it]));
    let words = 0;
    let minutes = 0;
    for (const e of s.history) {
      if (!isPlainObject(e)) continue;
      const w = Number(e.metrics?.words);
      if (Number.isFinite(w) && w > 0) words += w;
      minutes += entryMinutes(e, itemsById);
      const id = e.itemId;
      if (typeof id === 'string' && isSafeKey(id) && isPlainObject(s.items[id])) {
        const sc = Number(e.score) || 0;
        s.items[id].best = Math.max(Number(s.items[id].best) || 0, sc);
      }
    }
    s.counters.words = Math.max(Number(s.counters.words) || 0, Math.round(words));
    s.counters.minutes = Math.max(Number(s.counters.minutes) || 0, +minutes.toFixed(2));
    const firstTs = s.history.map((e) => Number(e?.ts)).filter((t) => Number.isFinite(t) && t > 0);
    if (!s.meta.createdAt && firstTs.length) s.meta.createdAt = Math.min(...firstTs);
    if (typeof s.name === 'string') s.profile.name = s.name;
  }
  validateShape(s);
  s.v = SCHEMA;
  s.meta.schema = SCHEMA;
  if (!s.profile.name && typeof s.name === 'string') s.profile.name = s.name;
  return s;
}

export const TASK_KINDS = ['warmup', 'fix', 'choice', 'speak', 'boss'];
const DATE_STR_RE = /^\d{4}-\d{2}-\d{2}$/;
const isDateStr = (v) => typeof v === 'string' && DATE_STR_RE.test(v);
const finite = (v, min, max, def = 0) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && typeof v !== 'boolean' && v !== null && v !== '' ? Math.max(min, Math.min(max, n)) : def;
};
const strOk = (v, max) => typeof v === 'string' && v.length <= max;

function validTask(t) {
  return (
    isPlainObject(t) &&
    strOk(t.id, 80) && !!t.id &&
    TASK_KINDS.includes(t.kind) &&
    Array.isArray(t.itemIds) && t.itemIds.every((x) => strOk(x, 64)) &&
    typeof t.xp === 'number' && Number.isFinite(t.xp) &&
    typeof t.minutes === 'number' && Number.isFinite(t.minutes) &&
    (t.title_he === undefined || strOk(t.title_he, 120))
  );
}

// Stored state is untrusted (the github.io origin is shared). Check element
// types inside arrays and maps, coerce numbers, drop what does not fit. Mutates s.
function validateShape(s) {
  const d = s.daily;
  if (
    !Array.isArray(d.tasks) || !d.tasks.every(validTask) || d.tasks.length > 20 ||
    !Array.isArray(d.done) || !d.done.every((x) => strOk(x, 80)) ||
    !(d.date === null || isDateStr(d.date)) || typeof d.bonus !== 'boolean'
  ) {
    s.daily = defaultState().daily;
  } else {
    s.daily.tasks = d.tasks.map((t) => ({
      ...t,
      xp: finite(t.xp, 0, 1000),
      minutes: finite(t.minutes, 0, 120),
      title_he: typeof t.title_he === 'string' ? t.title_he : '',
    }));
  }
  s.days = [...new Set(s.days.filter(isDateStr))];
  s.badges = [...new Set(s.badges.filter((b) => strOk(b, 64) && isSafeKey(b)))];
  s.xp = finite(s.xp, 0, 1e8);
  s.missions = finite(s.missions, 0, 1e7);
  s.streak = {
    ...s.streak,
    count: finite(s.streak.count, 0, 100000),
    best: finite(s.streak.best, 0, 100000),
    last: isDateStr(s.streak.last) ? s.streak.last : null,
  };
  const items = {};
  for (const [k, v] of Object.entries(s.items)) {
    if (!isSafeKey(k) || !strOk(k, 64) || !isPlainObject(v)) continue;
    const it = {
      ease: finite(v.ease, 1.3, 5, 2.5),
      interval: finite(v.interval, 0, 36500),
      due: finite(v.due, 0, 4102444800000),
      reps: finite(v.reps, 0, 1e5),
      lapses: finite(v.lapses, 0, 1e5),
      last: finite(v.last, 0, 4102444800000),
    };
    if (v.best !== undefined) it.best = finite(v.best, 0, 100);
    items[k] = it;
  }
  s.items = items;
  const hist = [];
  for (const e of s.history) {
    if (!isPlainObject(e) || !strOk(e.itemId, 64) || !e.itemId || !isSafeKey(e.itemId) || !isDateStr(e.date)) continue;
    const entry = {
      date: e.date,
      ts: finite(e.ts, 0, 4102444800000),
      taskId: typeof e.taskId === 'string' ? e.taskId.slice(0, 80) : '',
      taskKind: typeof e.taskKind === 'string' ? e.taskKind.slice(0, 20) : '',
      itemId: e.itemId,
      cat: strOk(e.cat, 64) && isSafeKey(e.cat) ? e.cat : null,
      score: finite(e.score, 0, 100),
      metrics: cleanMetrics(e.metrics),
    };
    if (strOk(e.itemType, 20) && e.itemType) entry.itemType = e.itemType;
    hist.push(entry);
  }
  s.history = hist.slice(-HISTORY_CAP);
  const c = s.counters;
  for (const k of ['fillerFree', 'perfect', 'boss', 'graded', 'mic', 'nightOwl', 'earlyBird', 'words', 'minutes']) c[k] = finite(c[k], 0, 1e9);
  const cats = {};
  for (const [k, v] of Object.entries(c.cats)) if (isSafeKey(k) && strOk(k, 64)) cats[k] = finite(v, 0, 1e9);
  c.cats = cats;
  const tracks = {};
  for (const [k, v] of Object.entries(s.tracks)) {
    if (!isSafeKey(k) || !strOk(k, 64) || !isPlainObject(v)) continue;
    const t = { bossPassed: v.bossPassed === true, bestScore: finite(v.bestScore, 0, 100) };
    if (v.completed === true) t.completed = true;
    if (v.completedAt !== undefined) t.completedAt = finite(v.completedAt, 0, 4102444800000);
    tracks[k] = t;
  }
  s.tracks = tracks;
  const p = s.profile;
  const strArr = (a, cap, max) => (Array.isArray(a) ? a.filter((x) => strOk(x, max)).slice(0, cap) : []);
  p.name = typeof p.name === 'string' ? p.name.slice(0, 24) : '';
  p.role = typeof p.role === 'string' ? p.role.slice(0, 60) : '';
  p.nativeLang = typeof p.nativeLang === 'string' ? p.nativeLang.slice(0, 8) : 'he';
  p.goals = strArr(p.goals, 10, 80);
  p.focusTracks = strArr(p.focusTracks, 20, 64);
  p.audiences = strArr(p.audiences, 20, 64);
  p.dailyGoalMin = finite(p.dailyGoalMin, 1, 240, 10);
  p.nextTalkDate = isDateStr(p.nextTalkDate) ? p.nextTalkDate : null;
  if (p.id !== null && !(typeof p.id === 'string' && UUID_RE.test(p.id))) p.id = null;
  p.createdAt = p.createdAt === null ? null : finite(p.createdAt, 0, 4102444800000, null);
  s.meta.createdAt = s.meta.createdAt === null ? null : finite(s.meta.createdAt, 0, 4102444800000, null);
  s.meta.updatedAt = s.meta.updatedAt === null ? null : finite(s.meta.updatedAt, 0, 4102444800000, null);
  if (typeof s.name === 'string') s.name = s.name.slice(0, 24);
  const set = s.settings;
  if (!['auto', 'on', 'off'].includes(set.onDevice)) set.onDevice = 'auto';
  if (!['system', 'light', 'dark'].includes(set.theme)) set.theme = 'system';
}

// Fill identity fields that a fresh or migrated state may lack. Returns a new object.
export function ensureIdentity(state, now = Date.now()) {
  const s = migrate(state);
  if (typeof s.profile.id !== 'string' || !UUID_RE.test(s.profile.id)) s.profile.id = uuidv4();
  if (!Number.isFinite(s.profile.createdAt) || !s.profile.createdAt) s.profile.createdAt = s.meta.createdAt || now;
  if (!Number.isFinite(s.meta.createdAt) || !s.meta.createdAt) s.meta.createdAt = s.profile.createdAt;
  if (!s.meta.updatedAt) s.meta.updatedAt = now;
  s.meta.appVersion = APP_VERSION;
  return s;
}

function normalize(state) {
  return migrate(state);
}

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

// Keep the old top-level name and profile.name in step: whichever changed wins.
function syncName(prev, next) {
  const n = next;
  if (n.name !== prev.name && typeof n.name === 'string') n.profile.name = n.name;
  else if (n.profile.name !== prev.profile.name && typeof n.profile.name === 'string' && n.profile.name) n.name = n.profile.name;
  return n;
}

export function createStore(storage) {
  let store = storage;
  if (store === undefined) {
    try {
      store = globalThis.localStorage;
    } catch {
      store = undefined;
    }
  }
  if (!store || typeof store.getItem !== 'function') store = memoryStorage();
  let cache = null;

  function read() {
    let raw = null;
    try {
      raw = store.getItem(STORE_KEY);
    } catch {
      raw = null;
    }
    let parsed = null;
    if (raw) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
    }
    if (!isPlainObject(parsed)) return normalize(null);
    // Upgrade on load: migrate, give the profile an id, and save the new shape.
    const needsUpgrade = Number(parsed.v) !== SCHEMA || !UUID_RE.test(String(parsed.profile?.id || ''));
    if (!needsUpgrade) return normalize(parsed);
    const up = ensureIdentity(parsed);
    write(up);
    return up;
  }

  function write(state) {
    try {
      store.setItem(STORE_KEY, JSON.stringify(state));
      return true;
    } catch {
      return false;
    }
  }

  return {
    get() {
      if (!cache) cache = read();
      return cache;
    },
    set(patchOrFn) {
      const cur = this.get();
      let next;
      try {
        if (typeof patchOrFn === 'function') {
          const res = patchOrFn(clone(cur));
          next = res === undefined ? cur : res;
        } else if (isPlainObject(patchOrFn)) {
          next = mergePatch(cur, patchOrFn);
        } else {
          next = cur;
        }
      } catch {
        next = cur;
      }
      const now = Date.now();
      cache = syncName(cur, ensureIdentity(next, now));
      cache.meta.updatedAt = now;
      write(cache);
      return cache;
    },
    reset() {
      try {
        store.removeItem(STORE_KEY);
      } catch {
        /* ignore */
      }
      cache = defaultState();
      return cache;
    },
  };
}

// Patch: plain objects merge recursively, arrays and values replace.
function mergePatch(base, patch) {
  const out = clone(base);
  for (const [k, v] of Object.entries(patch)) {
    if (!isSafeKey(k)) continue;
    out[k] = isPlainObject(v) && isPlainObject(out[k]) ? mergePatch(out[k], v) : clone(v);
  }
  return out;
}

// ---------- levels ----------

// Total XP needed to reach level L. L1 = 0, L2 = 100, L3 = 300, L4 = 600 ...
export function xpForLevel(level) {
  const n = Math.max(1, Math.floor(level)) - 1;
  return (100 * n * (n + 1)) / 2;
}

export function levelFromXp(xp, LEVEL_TITLES) {
  const x = Math.max(0, Number(xp) || 0);
  let level = 1;
  while (xpForLevel(level + 1) <= x) level++;
  const titles = contentTitles(LEVEL_TITLES);
  const title_he = titles.length ? titles[Math.min(level, titles.length) - 1] : `רמה ${level}`;
  const base = xpForLevel(level);
  const span = xpForLevel(level + 1) - base;
  const cur = x - base;
  return { level, title_he, cur, next: span, pct: Math.min(100, Math.round((cur / span) * 100)) };
}

// ---------- spaced repetition ----------

export function newItemState() {
  return { ease: 2.5, interval: 0, due: 0, reps: 0, lapses: 0, last: 0 };
}

export function scoreToQuality(score) {
  const s = Number(score) || 0;
  if (s >= 95) return 5;
  if (s >= 85) return 4;
  if (s >= 70) return 3;
  if (s >= 50) return 2;
  if (s >= 25) return 1;
  return 0;
}

// SM-2 lite. interval in days, due as epoch ms.
export function grade(itemState, quality, now = Date.now()) {
  const st = { ...newItemState(), ...(isPlainObject(itemState) ? itemState : {}) };
  const q = Math.max(0, Math.min(5, Math.round(Number(quality) || 0)));
  if (q < 3) {
    st.reps = 0;
    st.lapses += 1;
    st.interval = 1;
  } else {
    st.reps += 1;
    if (st.reps === 1) st.interval = 1;
    else if (st.reps === 2) st.interval = 3;
    else st.interval = Math.max(1, Math.round(st.interval * st.ease));
  }
  st.ease = Math.max(1.3, +(st.ease + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)).toFixed(3));
  st.due = now + st.interval * DAY_MS;
  st.last = now;
  return st;
}

// ---------- daily mission ----------

const TITLES = {
  warmup: ['חימום קולי', 'מחממים את הלשון', 'חימום מהיר לפה'],
  fix: ['תקן את המשפט', 'מצא את הטעות', 'מוסך משפטים'],
  choice: ['מה נשמע טבעי?', 'בחר את הנכון', 'אוזן של דובר'],
  speak: ['הבמה שלך', 'דקה של דיבור', 'המיקרופון שלך'],
  qa: ['הבוס: שאלה קשה', 'הבוס: שאלה מהקהל', 'הבוס: תענה בביטחון'],
  recall: ['הבוס: מהזיכרון', 'הבוס: בלי דף', 'הבוס: תגיד את זה בעל פה'],
};

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Order candidates: due first, then weak, then new, then the rest.
function rankItems(pool, state, dateStr, rng) {
  const end = endOfDay(dateStr);
  const st = (state && state.items) || {};
  const tagged = shuffle(pool, rng).map((it, idx) => {
    const s = st[it.id];
    let tier;
    let key;
    if (s && Number(s.due) <= end) {
      tier = 0;
      key = Number(s.due);
    } else if (s && (Number(s.lapses) > 0 || Number(s.ease) < 2.3)) {
      tier = 1;
      key = Number(s.ease) - Number(s.lapses || 0) * 0.1;
    } else if (!s) {
      tier = 2;
      key = (Number(it.level) || 1) + rng() * 1.5;
    } else {
      tier = 3;
      key = Number(s.due) || 0;
    }
    return { it, tier, key, idx };
  });
  tagged.sort((a, b) => a.tier - b.tier || a.key - b.key || a.idx - b.idx);
  return tagged.map((t) => t.it);
}

// Take n items in rank order, preferring categories not used yet.
function pickMixed(ranked, n, usedCats) {
  const out = [];
  const used = new Set(usedCats);
  const left = ranked.slice();
  while (out.length < n && left.length) {
    let i = left.findIndex((it) => !used.has(it.cat));
    if (i < 0) {
      used.clear();
      i = 0;
    }
    const [it] = left.splice(i, 1);
    out.push(it);
    used.add(it.cat);
  }
  return out;
}

function yesterdaySpeakIds(state, dateStr) {
  const y = addDays(dateStr, -1);
  const ids = new Set();
  const d = state && state.daily;
  if (d && d.date === y && Array.isArray(d.tasks)) {
    for (const t of d.tasks) if (t.kind === 'speak') (t.itemIds || []).forEach((id) => ids.add(id));
  }
  for (const h of (state && state.history) || []) {
    if (h.date === y && h.taskKind === 'speak') ids.add(h.itemId);
  }
  return ids;
}

export function generateDaily(state, ITEMS, dateStr = todayStr()) {
  const items = contentItems(ITEMS).filter((it) => it && it.id && it.type);
  const rng = seededRandom(`speakerTrainer:${dateStr}`);
  const byType = (t) => items.filter((it) => it.type === t);
  const title = (kind) => {
    const list = TITLES[kind];
    return list[Math.floor(rng() * list.length)];
  };
  const usedCats = [];
  const tasks = [];
  const add = (n, kind, picked, titleKind = kind) => {
    const t = title(titleKind);
    if (!picked.length) return;
    picked.forEach((it) => usedCats.push(it.cat));
    tasks.push({
      id: `${dateStr}-${n}`,
      kind,
      title_he: t,
      itemIds: picked.map((it) => it.id),
      xp: TASK_XP[kind],
      minutes: TASK_MINUTES[kind],
    });
  };

  const warmCount = rng() < 0.5 ? 2 : 3;
  add(1, 'warmup', pickMixed(rankItems(byType('shadow'), state, dateStr, rng), warmCount, usedCats));
  add(2, 'fix', pickMixed(rankItems(byType('fix'), state, dateStr, rng), 4, usedCats));
  add(3, 'choice', pickMixed(rankItems(byType('choice'), state, dateStr, rng), 4, usedCats));

  const banned = yesterdaySpeakIds(state, dateStr);
  let speakPool = byType('speak');
  const fresh = speakPool.filter((it) => !banned.has(it.id));
  if (fresh.length) speakPool = fresh;
  add(4, 'speak', pickMixed(rankItems(speakPool, state, dateStr, rng), 1, usedCats));

  const dayNum = dayDiff('1970-01-01', dateStr);
  let bossType = dayNum % 2 === 0 ? 'qa' : 'recall';
  if (!byType(bossType).length) bossType = bossType === 'qa' ? 'recall' : 'qa';
  add(5, 'boss', pickMixed(rankItems(byType(bossType), state, dateStr, rng), 1, usedCats), bossType);

  return { date: dateStr, tasks };
}

// Returns state with today's mission, generating it only when the date changed.
export function ensureDaily(state, ITEMS, dateStr = todayStr()) {
  const s = normalize(state);
  if (s.daily.date === dateStr && s.daily.tasks.length) return s;
  const d = generateDaily(s, ITEMS, dateStr);
  s.daily = { date: d.date, tasks: d.tasks, done: [], bonus: false };
  return s;
}

// ---------- completing tasks ----------

function updateStreak(streak, day) {
  const s = { count: 0, last: null, best: 0, ...streak };
  if (s.last === day) return { streak: s, up: false };
  const gap = s.last ? dayDiff(s.last, day) : null;
  if (gap !== null && gap < 0) return { streak: s, up: false }; // clock moved back
  s.count = gap === 1 ? s.count + 1 : 1;
  s.last = day;
  s.best = Math.max(Number(s.best) || 0, s.count);
  return { streak: s, up: true };
}

// Keep only known numeric metrics. Never transcript text, never audio.
export function cleanMetrics(m) {
  if (!isPlainObject(m)) return {};
  const out = {};
  const num = (v, max) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : undefined;
  };
  if (typeof m.fromMic === 'boolean') out.fromMic = m.fromMic;
  const caps = { words: 100000, wpm: 1000, durationSec: 7200, fillerTotal: 10000, fillersPerMin: 1000 };
  for (const [k, max] of Object.entries(caps)) {
    const v = num(m[k], max);
    if (v !== undefined) out[k] = v;
  }
  if (Array.isArray(m.beDrops)) out.beDrops = Math.min(10000, m.beDrops.length);
  else {
    const v = num(m.beDrops, 10000);
    if (v !== undefined) out.beDrops = v;
  }
  if (isPlainObject(m.fillers)) {
    const f = {};
    let n = 0;
    for (const [k, v] of Object.entries(m.fillers)) {
      if (n >= 30) break;
      if (!isSafeKey(k) || !/^[a-z][a-z' -]{0,23}$/i.test(k)) continue;
      const c = num(v, 10000);
      if (c === undefined) continue;
      f[k.toLowerCase()] = c;
      n++;
    }
    out.fillers = f;
  }
  return out;
}

// Grade items, write history and counters for one finished session. Mutates s.
function recordResults(s, list, { taskId, taskKind, now, itemsById }) {
  const day = todayStr(new Date(now));
  const c = s.counters;
  for (const r of list) {
    const score = Math.max(0, Math.min(100, Number(r.score) || 0));
    const metrics = cleanMetrics(r.metrics);
    const prev = s.items[r.itemId];
    s.items[r.itemId] = grade(prev, scoreToQuality(score), now);
    s.items[r.itemId].best = Math.max(Number(prev?.best) || 0, score);
    const item = itemsById.get(r.itemId);
    const cat = item?.cat || null;
    const itemType = item?.type || (taskKind in KIND_TO_TYPE && taskKind !== 'boss' ? KIND_TO_TYPE[taskKind] : null);
    const entry = { date: day, ts: now, taskId, taskKind, itemId: r.itemId, cat, score, metrics };
    if (itemType) entry.itemType = itemType;
    s.history.push(entry);
    c.graded += 1;
    if (cat) c.cats[cat] = (c.cats[cat] || 0) + 1;
    if (score >= 95) c.perfect += 1;
    if ((taskKind === 'speak' || itemType === 'speak') && metrics.fillerTotal === 0) c.fillerFree += 1;
    if (metrics.fromMic === true) c.mic += 1;
    if (Number(metrics.words) > 0) c.words = (Number(c.words) || 0) + Math.round(metrics.words);
    c.minutes = +((Number(c.minutes) || 0) + entryMinutes(entry, itemsById)).toFixed(2);
  }
  if (s.history.length > HISTORY_CAP) s.history = s.history.slice(-HISTORY_CAP);
}

function recordVisit(s, now) {
  const day = todayStr(new Date(now));
  const hour = new Date(now).getHours();
  if (hour >= 22 || hour < 5) s.counters.nightOwl += 1;
  if (hour >= 5 && hour < 8) s.counters.earlyBird += 1;
  const st = updateStreak(s.streak, day);
  s.streak = st.streak;
  if (!s.days.includes(day)) s.days.push(day);
  return st.up;
}

function badgeCtx(opts) {
  return { items: opts.items, tracks: opts.tracks };
}

export function completeTask(state, taskId, results = [], now = Date.now(), opts = {}) {
  const s = normalize(state);
  const task = (s.daily.tasks || []).find((t) => t.id === taskId);
  if (!task) return { state: s, xpGained: 0, newBadges: [], streakUp: false };

  const itemsById = new Map(contentItems(opts.items).map((it) => [it.id, it]));
  const list = Array.isArray(results) ? results.filter((r) => r && typeof r.itemId === 'string' && isSafeKey(r.itemId)) : [];
  const repeat = s.daily.done.includes(taskId);

  // XP
  let xp = Number(task.xp) || TASK_XP[task.kind] || 0;
  if (list.length && list.every((r) => Number(r.score) >= 80)) xp = Math.round(xp * 1.2);
  if (repeat) xp = Math.round(xp / 2);

  recordResults(s, list, { taskId, taskKind: task.kind, now, itemsById });
  if (task.kind === 'boss' && !repeat) s.counters.boss += 1;

  // daily mission
  if (!repeat) s.daily.done.push(taskId);
  const allDone = s.daily.tasks.length > 0 && s.daily.tasks.every((t) => s.daily.done.includes(t.id));
  if (allDone && !s.daily.bonus) {
    s.daily.bonus = true;
    s.missions += 1;
    xp += MISSION_BONUS_XP;
  }
  s.xp += xp;

  const streakUp = recordVisit(s, now);
  const newBadges = evaluateBadges(s, opts.badges, badgeCtx(opts));
  s.badges.push(...newBadges);
  return { state: s, xpGained: xp, newBadges, streakUp };
}

// ---------- tracks and units ----------

function findUnit(TRACKS, unitId) {
  for (const t of contentTracks(TRACKS)) {
    for (const u of (t && Array.isArray(t.units) ? t.units : [])) if (u && u.id === unitId) return { track: t, unit: u };
  }
  return null;
}

function unitItemIds(unit, itemsById) {
  const ids = Array.isArray(unit?.itemIds) ? unit.itemIds.filter((id) => typeof id === 'string') : [];
  return itemsById.size ? ids.filter((id) => itemsById.has(id)) : ids;
}

const bestOf = (state, id) => Number(state.items?.[id]?.best) || 0;

// Unit progress ignoring locks: { met, pct }.
function unitCheck(state, unit, itemsById) {
  const ids = unitItemIds(unit, itemsById);
  const hasBoss = typeof unit?.bossId === 'string' && unit.bossId;
  const bossOk = !hasBoss || !!state.tracks?.[unit.id]?.bossPassed;
  const passed = ids.filter((id) => bestOf(state, id) >= PASS_SCORE).length;
  const total = ids.length + (hasBoss ? 1 : 0);
  const got = passed + (hasBoss && bossOk ? 1 : 0);
  return { met: passed === ids.length && bossOk, pct: total ? Math.round((got / total) * 100) : 0 };
}

// { [trackId]: { pct, unitsDone, unitsTotal, currentUnitId, units:{ [unitId]:{ status, pct } } } }
// First unit is always open. A unit is done when every item has best >= 70 and its boss passed.
// The next unit opens only when the one before it is done.
export function trackProgress(state, TRACKS, ITEMS) {
  const s = normalize(state);
  const itemsById = new Map(contentItems(ITEMS).map((it) => [it.id, it]));
  const out = {};
  for (const t of contentTracks(TRACKS)) {
    if (!t || typeof t.id !== 'string' || !isSafeKey(t.id)) continue;
    const units = {};
    let prevDone = true;
    let unitsDone = 0;
    let sumPct = 0;
    let currentUnitId = null;
    const list = Array.isArray(t.units) ? t.units.filter((u) => u && typeof u.id === 'string' && isSafeKey(u.id)) : [];
    for (const u of list) {
      const chk = unitCheck(s, u, itemsById);
      let status;
      if (!prevDone) status = 'locked';
      else if (chk.met) status = 'done';
      else status = 'open';
      if (status === 'done') unitsDone += 1;
      if (status === 'open' && !currentUnitId) currentUnitId = u.id;
      const pct = status === 'done' ? 100 : chk.pct;
      sumPct += pct;
      units[u.id] = { status, pct };
      prevDone = status === 'done';
    }
    out[t.id] = {
      pct: list.length ? Math.round(sumPct / list.length) : 0,
      unitsDone,
      unitsTotal: list.length,
      currentUnitId,
      units,
    };
  }
  return out;
}

// A playable session for one unit. Practice items first, boss last.
export function buildUnitSession(state, unit, ITEMS) {
  const s = normalize(state);
  const itemsById = new Map(contentItems(ITEMS).map((it) => [it.id, it]));
  const bossId = typeof unit?.bossId === 'string' && (!itemsById.size || itemsById.has(unit.bossId)) ? unit.bossId : null;
  const itemIds = [...new Set(unitItemIds(unit, itemsById).filter((id) => id !== bossId))];
  if (bossId) itemIds.push(bossId);
  const tr = s.tracks[unit?.id] || {};
  const xp = itemIds.length * PRACTICE_ITEM_XP + (bossId && !tr.bossPassed ? BOSS_PASS_XP : 0) + (tr.completed ? 0 : UNIT_DONE_XP);
  return { id: `unit:${unit?.id}`, kind: 'unit', title_he: unit?.title_he || '', itemIds, bossId, xp };
}

// Finish a unit:* or practice:* session (free practice outside the daily mission).
// XP: +5 per item with score >= 60, +40 the first time the unit boss passes (>= 70),
// +60 once per unit when it becomes done. Same return shape as completeTask, plus
// unitDone and bossPassed flags.
export function completePractice(state, sessionId, results = [], now = Date.now(), opts = {}) {
  const s = normalize(state);
  const id = typeof sessionId === 'string' ? sessionId : '';
  const isUnit = id.startsWith('unit:');
  const isPractice = id.startsWith('practice:') || id.startsWith('practice-');
  const empty = { state: s, xpGained: 0, newBadges: [], streakUp: false, unitDone: false, bossPassed: false };
  if (!isUnit && !isPractice) return empty;
  const list = Array.isArray(results) ? results.filter((r) => r && typeof r.itemId === 'string' && isSafeKey(r.itemId)) : [];
  if (!list.length) return empty;

  const itemsById = new Map(contentItems(opts.items).map((it) => [it.id, it]));
  const found = isUnit ? findUnit(opts.tracks, id.slice(5)) : null;
  const unit = found?.unit || null;
  const taskKind = isUnit ? 'unit' : 'practice';

  let xp = 0;
  for (const r of list) if (Number(r.score) >= 60) xp += PRACTICE_ITEM_XP;
  recordResults(s, list, { taskId: id, taskKind, now, itemsById });

  let bossPassed = false;
  let unitDone = false;
  if (unit && isSafeKey(unit.id)) {
    const tr = (s.tracks[unit.id] = { bossPassed: false, bestScore: 0, ...(isPlainObject(s.tracks[unit.id]) ? s.tracks[unit.id] : {}) });
    const avg = Math.round(list.reduce((a, r) => a + Math.max(0, Math.min(100, Number(r.score) || 0)), 0) / list.length);
    tr.bestScore = Math.max(Number(tr.bestScore) || 0, avg);
    const boss = unit.bossId ? list.find((r) => r.itemId === unit.bossId) : null;
    if (boss && Number(boss.score) >= PASS_SCORE) {
      bossPassed = true;
      if (!tr.bossPassed) {
        tr.bossPassed = true;
        xp += BOSS_PASS_XP;
        s.counters.boss += 1;
      }
    }
    if (!tr.completed && unitCheck(s, unit, itemsById).met) {
      tr.completed = true;
      tr.completedAt = now;
      xp += UNIT_DONE_XP;
      unitDone = true;
    }
  }
  s.xp += xp;

  const streakUp = recordVisit(s, now);
  const newBadges = evaluateBadges(s, opts.badges, badgeCtx(opts));
  s.badges.push(...newBadges);
  return { state: s, xpGained: xp, newBadges, streakUp, unitDone, bossPassed };
}

// ---------- badges ----------

// True when the rule is met. Unknown or broken rules are false.
// ctx (optional): { items: ITEMS, tracks: TRACKS } for the 'track:N' rule.
export function checkRule(rule, state, ctx = {}) {
  if (typeof rule !== 'string' || !rule) return false;
  const s = state;
  const c = s.counters || {};
  const parts = rule.split(':');
  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  switch (parts[0]) {
    case 'first_mic':
      return parts.length === 1 && (c.mic || 0) >= 1;
    case 'night_owl':
      return parts.length === 1 && (c.nightOwl || 0) >= 1;
    case 'early_bird':
      return parts.length === 1 && (c.earlyBird || 0) >= 1;
    case 'cat': {
      const n = num(parts[2]);
      return parts.length === 3 && !!parts[1] && n !== null && ((c.cats || {})[parts[1]] || 0) >= n;
    }
    default: {
      if (parts.length !== 2) return false;
      const n = num(parts[1]);
      if (n === null) return false;
      switch (parts[0]) {
        case 'streak':
          return Math.max(s.streak?.count || 0, s.streak?.best || 0) >= n;
        case 'xp':
          return (s.xp || 0) >= n;
        case 'level':
          return levelFromXp(s.xp || 0, []).level >= n;
        case 'fillerfree':
          return (c.fillerFree || 0) >= n;
        case 'perfect':
          return (c.perfect || 0) >= n;
        case 'boss':
          return (c.boss || 0) >= n;
        case 'mission':
        case 'daily':
          return (s.missions || 0) >= n;
        case 'mastered':
          return Object.values(s.items || {}).filter((it) => (it?.reps || 0) >= 3 && (it?.interval || 0) >= 7).length >= n;
        case 'unit':
          return Object.values(s.tracks || {}).filter((t) => t && t.completed === true).length >= n;
        case 'track':
          return tracksDoneCount(s, ctx.tracks, ctx.items) >= n;
        case 'words':
          return wordsTotal(s) >= n;
        case 'minutes':
          return minutesTotal(s, new Map(contentItems(ctx.items).map((it) => [it.id, it]))) >= n;
        case 'cats':
          return Object.values(c.cats || {}).filter((v) => Number(v) > 0).length >= n;
        case 'wpm_band':
          return (s.history || []).filter((e) => e.taskKind === 'speak' && Number(e.metrics?.wpm) >= 110 && Number(e.metrics?.wpm) <= 150).length >= n;
        default:
          return false;
      }
    }
  }
}

export function evaluateBadges(state, BADGES, ctx = {}) {
  const have = new Set(state.badges || []);
  const out = [];
  for (const b of contentBadges(BADGES)) {
    if (!b || !b.id || have.has(b.id)) continue;
    let ok = false;
    try {
      ok = checkRule(b.rule, state, ctx || {});
    } catch {
      ok = false;
    }
    if (ok) {
      out.push(b.id);
      have.add(b.id);
    }
  }
  return out;
}

// ---------- stats ----------

function tracksDoneCount(state, TRACKS, ITEMS) {
  const tracks = contentTracks(TRACKS);
  if (!tracks.length) return 0;
  return Object.values(trackProgress(state, tracks, ITEMS)).filter((t) => t.unitsTotal > 0 && t.unitsDone === t.unitsTotal).length;
}

function wordsTotal(s) {
  let fromHist = 0;
  for (const e of s.history || []) {
    const w = Number(e?.metrics?.words);
    if (Number.isFinite(w) && w > 0) fromHist += w;
  }
  return Math.max(Number(s.counters?.words) || 0, Math.round(fromHist));
}

function minutesTotal(s, itemsById) {
  let fromHist = 0;
  for (const e of s.history || []) if (isPlainObject(e)) fromHist += entryMinutes(e, itemsById);
  return +Math.max(Number(s.counters?.minutes) || 0, fromHist).toFixed(1);
}

const lastN = (arr, n) => arr.slice(-n);
const round1 = (n) => Math.round(n * 10) / 10;

// ITEMS and TRACKS are optional (content.js is used when left out). now sets "today".
export function stats(state, ITEMS, TRACKS, now = Date.now()) {
  const s = normalize(state);
  const h = s.history.filter(isPlainObject);
  const itemsById = new Map(contentItems(ITEMS).map((it) => [it.id, it]));
  const sessions = new Set(h.map((e) => e.taskId || `${e.date}|${e.taskKind}`)).size;
  const avgScore = h.length ? Math.round(h.reduce((a, e) => a + (Number(e.score) || 0), 0) / h.length) : 0;
  const isSpeak = (e) => e.taskKind === 'speak' || histType(e, itemsById) === 'speak';
  const fillersPerMinTrend = h
    .filter((e) => isSpeak(e) && e.metrics)
    .map((e) => {
      const m = e.metrics;
      if (Number.isFinite(m.fillersPerMin)) return m.fillersPerMin;
      if (Number.isFinite(m.fillerTotal) && Number(m.durationSec) > 0) {
        return +(m.fillerTotal / (m.durationSec / 60)).toFixed(2);
      }
      return null;
    })
    .filter((v) => v !== null)
    .slice(-10);
  const byCat = {};
  for (const e of h) {
    const cat = e.cat || itemsById.get(e.itemId)?.cat;
    if (!cat || !isSafeKey(cat)) continue;
    const b = (byCat[cat] = byCat[cat] || { count: 0, avg: 0, sum: 0 });
    b.count += 1;
    b.sum += Number(e.score) || 0;
  }
  for (const b of Object.values(byCat)) {
    b.avg = Math.round(b.sum / b.count);
    delete b.sum;
  }
  const mastered = Object.values(s.items).filter((it) => Number(it?.interval) >= 21).length;

  // minutes
  const today = todayStr(new Date(now));
  const perDay = new Map();
  for (const e of h) {
    if (typeof e.date !== 'string') continue;
    perDay.set(e.date, (perDay.get(e.date) || 0) + entryMinutes(e, itemsById));
  }
  const minutesByDay = [];
  for (let i = 29; i >= 0; i--) {
    const date = addDays(today, -i);
    minutesByDay.push({ date, min: round1(perDay.get(date) || 0) });
  }
  const todayMin = round1(perDay.get(today) || 0);
  const goal = Number(s.profile.dailyGoalMin) > 0 ? Number(s.profile.dailyGoalMin) : 10;
  const goalPct = Math.min(100, Math.round((Math.round(todayMin * 10) * 10) / goal));

  // trends
  const wpmTrend = lastN(h.map((e) => Number(e.metrics?.wpm)).filter((v) => Number.isFinite(v) && v > 0), 10);
  const sessionScores = new Map();
  for (const e of h) {
    const k = e.taskId || `${e.date}|${e.taskKind}`;
    const b = sessionScores.get(k) || { sum: 0, n: 0 };
    b.sum += Number(e.score) || 0;
    b.n += 1;
    sessionScores.set(k, b);
  }
  const scoreTrend = lastN([...sessionScores.values()].map((b) => Math.round(b.sum / b.n)), 10);

  // skills
  const accuracyByCat = {};
  for (const [cat, b] of Object.entries(byCat)) accuracyByCat[cat] = { avg: b.avg, count: b.count };
  const ranked = Object.entries(accuracyByCat).sort((a, b) => a[1].avg - b[1].avg || b[1].count - a[1].count || (a[0] < b[0] ? -1 : 1));
  const weakest = ranked.slice(0, 3).map(([c]) => c);
  const strongest = ranked.slice().sort((a, b) => b[1].avg - a[1].avg || b[1].count - a[1].count || (a[0] < b[0] ? -1 : 1)).slice(0, 3).map(([c]) => c);

  const fillerTotals = {};
  for (const e of h) {
    const f = e.metrics?.fillers;
    if (!isPlainObject(f)) continue;
    for (const [k, v] of Object.entries(f)) {
      if (!isSafeKey(k) || !Number.isFinite(Number(v))) continue;
      fillerTotals[k] = (fillerTotals[k] || 0) + Number(v);
    }
  }
  const activeDays = new Set([...s.days, ...h.map((e) => e.date)].filter((d) => typeof d === 'string')).size;
  const tracks = contentTracks(TRACKS);
  const tp = tracks.length ? trackProgress(s, tracks, ITEMS) : {};
  const tracksDone = Object.values(tp).filter((t) => t.unitsTotal > 0 && t.unitsDone === t.unitsTotal).length;
  const unitsDone = Object.values(tp).reduce((a, t) => a + t.unitsDone, 0);

  return {
    totalXp: s.xp,
    sessions,
    avgScore,
    fillersPerMinTrend,
    bestStreak: Math.max(s.streak.best || 0, s.streak.count || 0),
    mastered,
    byCat,
    minutesTotal: minutesTotal(s, itemsById),
    minutesByDay,
    todayMin,
    goalPct,
    wordsSpoken: wordsTotal(s),
    wpmTrend,
    scoreTrend,
    accuracyByCat,
    weakest,
    strongest,
    fillerTotals,
    activeDays,
    tracksDone,
    unitsDone,
  };
}
