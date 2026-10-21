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

// ---------- content fallback ----------

let CONTENT = {};
try {
  CONTENT = await import('./content.js');
} catch {
  CONTENT = {};
}

// Lets the app (or tests) set content explicitly. Any key left out keeps its current value.
export function configure({ ITEMS, BADGES, LEVEL_TITLES_HE } = {}) {
  CONTENT = { ...CONTENT };
  if (ITEMS) CONTENT.ITEMS = ITEMS;
  if (BADGES) CONTENT.BADGES = BADGES;
  if (LEVEL_TITLES_HE) CONTENT.LEVEL_TITLES_HE = LEVEL_TITLES_HE;
}

function contentItems(items) {
  return Array.isArray(items) ? items : Array.isArray(CONTENT.ITEMS) ? CONTENT.ITEMS : [];
}
function contentBadges(badges) {
  return Array.isArray(badges) ? badges : Array.isArray(CONTENT.BADGES) ? CONTENT.BADGES : [];
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

export function defaultState() {
  return {
    v: 1,
    name: 'Daniel',
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
    counters: { fillerFree: 0, perfect: 0, boss: 0, graded: 0, mic: 0, nightOwl: 0, earlyBird: 0, cats: {} },
  };
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Merge saved over defaults. Types of known keys are kept; unknown keys survive.
export function deepMerge(defaults, saved) {
  if (saved === undefined) return clone(defaults);
  if (isPlainObject(defaults)) {
    if (!isPlainObject(saved)) return clone(defaults);
    const out = {};
    for (const k of Object.keys(defaults)) out[k] = deepMerge(defaults[k], saved[k]);
    for (const k of Object.keys(saved)) if (!(k in defaults)) out[k] = clone(saved[k]);
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

function normalize(state) {
  return deepMerge(defaultState(), isPlainObject(state) ? state : {});
}

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
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
    return normalize(parsed);
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
      cache = normalize(next);
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

export function completeTask(state, taskId, results = [], now = Date.now(), opts = {}) {
  const s = normalize(state);
  const task = (s.daily.tasks || []).find((t) => t.id === taskId);
  if (!task) return { state: s, xpGained: 0, newBadges: [], streakUp: false };

  const itemsById = new Map(contentItems(opts.items).map((it) => [it.id, it]));
  const day = todayStr(new Date(now));
  const hour = new Date(now).getHours();
  const list = Array.isArray(results) ? results.filter((r) => r && r.itemId) : [];
  const repeat = s.daily.done.includes(taskId);

  // XP
  let xp = Number(task.xp) || TASK_XP[task.kind] || 0;
  if (list.length && list.every((r) => Number(r.score) >= 80)) xp = Math.round(xp * 1.2);
  if (repeat) xp = Math.round(xp / 2);

  // items, history, counters
  const c = s.counters;
  for (const r of list) {
    const score = Math.max(0, Math.min(100, Number(r.score) || 0));
    const metrics = isPlainObject(r.metrics) ? r.metrics : {};
    s.items[r.itemId] = grade(s.items[r.itemId], scoreToQuality(score), now);
    const cat = itemsById.get(r.itemId)?.cat || null;
    s.history.push({ date: day, ts: now, taskId, taskKind: task.kind, itemId: r.itemId, cat, score, metrics });
    c.graded += 1;
    if (cat) c.cats[cat] = (c.cats[cat] || 0) + 1;
    if (score >= 95) c.perfect += 1;
    if (task.kind === 'speak' && metrics.fillerTotal === 0) c.fillerFree += 1;
    if (metrics.fromMic === true) c.mic += 1;
  }
  if (s.history.length > HISTORY_CAP) s.history = s.history.slice(-HISTORY_CAP);
  if (task.kind === 'boss' && !repeat) c.boss += 1;
  if (hour >= 22 || hour < 5) c.nightOwl += 1;
  if (hour >= 5 && hour < 8) c.earlyBird += 1;

  // daily mission
  if (!repeat) s.daily.done.push(taskId);
  const allDone = s.daily.tasks.length > 0 && s.daily.tasks.every((t) => s.daily.done.includes(t.id));
  if (allDone && !s.daily.bonus) {
    s.daily.bonus = true;
    s.missions += 1;
    xp += MISSION_BONUS_XP;
  }
  s.xp += xp;

  // streak and days
  const st = updateStreak(s.streak, day);
  s.streak = st.streak;
  if (!s.days.includes(day)) s.days.push(day);

  const newBadges = evaluateBadges(s, opts.badges);
  s.badges.push(...newBadges);
  return { state: s, xpGained: xp, newBadges, streakUp: st.up };
}

// ---------- badges ----------

// True when the rule is met. Unknown or broken rules are false.
export function checkRule(rule, state) {
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
        case 'wpm_band':
          return (s.history || []).filter((e) => e.taskKind === 'speak' && Number(e.metrics?.wpm) >= 110 && Number(e.metrics?.wpm) <= 150).length >= n;
        default:
          return false;
      }
    }
  }
}

export function evaluateBadges(state, BADGES) {
  const have = new Set(state.badges || []);
  const out = [];
  for (const b of contentBadges(BADGES)) {
    if (!b || !b.id || have.has(b.id)) continue;
    let ok = false;
    try {
      ok = checkRule(b.rule, state);
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

export function stats(state) {
  const s = normalize(state);
  const h = s.history;
  const sessions = new Set(h.map((e) => e.taskId || `${e.date}|${e.taskKind}`)).size;
  const avgScore = h.length ? Math.round(h.reduce((a, e) => a + (Number(e.score) || 0), 0) / h.length) : 0;
  const fillersPerMinTrend = h
    .filter((e) => e.taskKind === 'speak' && e.metrics)
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
    if (!e.cat) continue;
    const b = (byCat[e.cat] = byCat[e.cat] || { count: 0, avg: 0, sum: 0 });
    b.count += 1;
    b.sum += Number(e.score) || 0;
  }
  for (const b of Object.values(byCat)) {
    b.avg = Math.round(b.sum / b.count);
    delete b.sum;
  }
  const mastered = Object.values(s.items).filter((it) => Number(it.interval) >= 21).length;
  return {
    totalXp: s.xp,
    sessions,
    avgScore,
    fillersPerMinTrend,
    bestStreak: Math.max(s.streak.best || 0, s.streak.count || 0),
    mastered,
    byCat,
  };
}
