// Speaker Trainer - data layer.
// Export, import, a local storage adapter, and an anonymous summary.
// Imported JSON is untrusted: only known keys are copied, numbers are clamped,
// strings and arrays are capped, and keys like __proto__ are ignored. No eval.

import {
  SCHEMA,
  APP_VERSION,
  HISTORY_CAP,
  UUID_RE,
  createStore,
  defaultState,
  migrate,
  ensureIdentity,
  cleanMetrics,
  isSafeKey,
  levelFromXp,
  stats,
} from './engine.js';

export const APP_ID = 'speaker-trainer';
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

export const ERR_HE = {
  empty: 'לא הודבק שום טקסט.',
  tooBig: 'הקובץ גדול מדי (מעל 2MB).',
  badJson: 'זה לא JSON תקין. העתק את כל הטקסט מהייצוא ונסה שוב.',
  notOurs: 'הנתונים האלה לא שייכים ל-Speaker Trainer.',
  tooNew: 'הנתונים נשמרו בגרסה חדשה יותר של האפליקציה. עדכן ונסה שוב.',
  badShape: 'מבנה הנתונים לא תקין.',
};
export const KNOWN_SCHEMAS = [1, 2];

/**
 * Future remote sync adapter. NOT built yet; LocalAdapter below has the same
 * load/save shape so a backend can be swapped in later.
 *
 * @typedef {Object} RemoteAdapter
 * @property {() => Promise<object>} load
 *   Fetch the user's state from the server. Resolves to a v2 state, already
 *   passed through importData-level validation on the client.
 * @property {(state: object) => Promise<void>} save
 *   Push the full state. The server stores it per profile.id. Never send audio
 *   or transcript text (the state does not hold them).
 * @property {(local: object) => Promise<object>} sync
 *   Two-way merge of local and remote, resolves to the merged state, which the
 *   caller then saves locally. Conflict rule:
 *   - Last writer wins per field group. Groups: profile, settings, daily,
 *     items (per item id), tracks (per unit id), badges (union), and the
 *     scalar group { xp, streak, missions, counters, days, onboarded, name }.
 *     Each group carries its own updatedAt; the newer group wins as a whole.
 *   - history is merged, not overwritten: union of both sides, deduped by the
 *     key ts + taskId + itemId, sorted by ts, then capped at HISTORY_CAP.
 *   - meta.updatedAt becomes max(local, remote).
 *   Auth, transport and encryption belong to the backend, not this module.
 */

// ---------- small sanitizers ----------

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^[A-Za-z0-9_.:-]{1,64}$/;

function num(v, min, max, def = min) {
  const n = Number(v);
  if (typeof v === 'boolean' || v === null || v === '' || !Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
}
const int = (v, min, max, def = min) => Math.round(num(v, min, max, def));
function str(v, max, def = '') {
  return typeof v === 'string' ? v.slice(0, max) : def;
}
const bool = (v, def = false) => (typeof v === 'boolean' ? v : def);
const dateOrNull = (v) => (typeof v === 'string' && DATE_RE.test(v) ? v : null);
const id = (v) => (typeof v === 'string' && ID_RE.test(v) && isSafeKey(v) ? v : null);
const oneOf = (v, list, def) => (list.includes(v) ? v : def);
function strList(v, cap, maxLen, check = null) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const x of v) {
    if (out.length >= cap) break;
    if (typeof x !== 'string') continue;
    const s = x.slice(0, maxLen);
    if (check && !check(s)) continue;
    out.push(s);
  }
  return out;
}
// Copy an untrusted map with safe keys only.
function safeMap(v, cap, keyOk, valFn) {
  const out = {};
  if (!isObj(v)) return out;
  let n = 0;
  for (const k of Object.keys(v)) {
    if (n >= cap) break;
    if (!isSafeKey(k) || !keyOk(k)) continue;
    const val = valFn(v[k]);
    if (val === undefined) continue;
    out[k] = val;
    n++;
  }
  return out;
}
const MAX_TS = 4102444800000; // 2100-01-01
const ts = (v) => (v === null || v === undefined ? null : int(v, 0, MAX_TS, null));

// ---------- state sanitizer ----------

function cleanItemState(v) {
  if (!isObj(v)) return undefined;
  const out = {
    ease: num(v.ease, 1.3, 5, 2.5),
    interval: int(v.interval, 0, 36500, 0),
    due: int(v.due, 0, MAX_TS, 0),
    reps: int(v.reps, 0, 100000, 0),
    lapses: int(v.lapses, 0, 100000, 0),
    last: int(v.last, 0, MAX_TS, 0),
  };
  if (v.best !== undefined) out.best = num(v.best, 0, 100, 0);
  return out;
}

function cleanHistory(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const e of v.slice(-HISTORY_CAP)) {
    if (!isObj(e)) continue;
    const itemId = id(e.itemId);
    const date = dateOrNull(e.date);
    if (!itemId || !date) continue;
    const entry = {
      date,
      ts: int(e.ts, 0, MAX_TS, 0),
      taskId: str(e.taskId, 80),
      taskKind: str(e.taskKind, 20),
      itemId,
      cat: id(e.cat),
      score: num(e.score, 0, 100, 0),
      metrics: cleanMetrics(e.metrics), // whitelist: drops transcript, audio and any other field
    };
    const t = id(e.itemType);
    if (t) entry.itemType = t.slice(0, 20);
    out.push(entry);
  }
  return out;
}

const TASK_KINDS = ['warmup', 'fix', 'choice', 'speak', 'boss'];
const EMPTY_DAILY = () => ({ date: null, tasks: [], done: [], bonus: false });

// Any invalid task drops the whole daily mission; the app regenerates it.
function cleanDaily(v) {
  if (!isObj(v) || !Array.isArray(v.tasks) || v.tasks.length > 10) return EMPTY_DAILY();
  const tasks = [];
  for (const t of v.tasks) {
    const ok =
      isObj(t) &&
      typeof t.id === 'string' && t.id.length > 0 && t.id.length <= 80 &&
      TASK_KINDS.includes(t.kind) &&
      Array.isArray(t.itemIds) && t.itemIds.length <= 20 && t.itemIds.every((x) => !!id(x)) &&
      typeof t.xp === 'number' && Number.isFinite(t.xp) &&
      typeof t.minutes === 'number' && Number.isFinite(t.minutes) &&
      (t.title_he === undefined || typeof t.title_he === 'string');
    if (!ok) return EMPTY_DAILY();
    tasks.push({
      id: t.id,
      kind: t.kind,
      title_he: str(t.title_he, 80),
      itemIds: t.itemIds.slice(),
      xp: int(t.xp, 0, 1000, 0),
      minutes: num(t.minutes, 0, 120, 0),
    });
  }
  return { date: dateOrNull(v.date), tasks, done: strList(v.done, 10, 80), bonus: bool(v.bonus) };
}

function cleanCounters(v) {
  const c = isObj(v) ? v : {};
  const n = (x) => int(x, 0, 1e9, 0);
  return {
    fillerFree: n(c.fillerFree),
    perfect: n(c.perfect),
    boss: n(c.boss),
    graded: n(c.graded),
    mic: n(c.mic),
    nightOwl: n(c.nightOwl),
    earlyBird: n(c.earlyBird),
    words: n(c.words),
    minutes: num(c.minutes, 0, 1e7, 0),
    cats: safeMap(c.cats, 100, (k) => !!id(k), (x) => int(x, 0, 1e9, 0)),
  };
}

function cleanProfile(v, fallbackName) {
  const p = isObj(v) ? v : {};
  return {
    id: typeof p.id === 'string' && UUID_RE.test(p.id) ? p.id.toLowerCase() : null,
    name: str(p.name, 24, fallbackName),
    role: str(p.role, 60),
    nativeLang: str(p.nativeLang, 8, 'he') || 'he',
    goals: strList(p.goals, 10, 80),
    focusTracks: strList(p.focusTracks, 20, 64, (x) => !!id(x)),
    dailyGoalMin: int(p.dailyGoalMin, 1, 240, 10),
    nextTalkDate: dateOrNull(p.nextTalkDate),
    audiences: strList(p.audiences, 20, 64, (x) => !!id(x)),
    createdAt: ts(p.createdAt),
  };
}

/**
 * Build a clean state from untrusted input. Only known keys survive.
 * The result still goes through migrate() so old shapes upgrade.
 */
export function sanitizeState(raw) {
  const r = isObj(raw) ? raw : {};
  const d = defaultState();
  const name = str(r.name, 24, d.name);
  const streak = isObj(r.streak) ? r.streak : {};
  const settings = isObj(r.settings) ? r.settings : {};
  const meta = isObj(r.meta) ? r.meta : {};
  const out = {
    v: int(r.v, 1, SCHEMA, 1),
    name,
    onboarded: bool(r.onboarded),
    xp: int(r.xp, 0, 1e8, 0),
    streak: {
      count: int(streak.count, 0, 100000, 0),
      last: dateOrNull(streak.last),
      best: int(streak.best, 0, 100000, 0),
    },
    days: [...new Set(strList(r.days, 3660, 10, (x) => DATE_RE.test(x)))],
    items: safeMap(r.items, 5000, (k) => !!id(k), cleanItemState),
    history: cleanHistory(r.history),
    badges: [...new Set(strList(r.badges, 300, 64, (x) => !!id(x)))],
    settings: {
      onDevice: oneOf(settings.onDevice, ['auto', 'on', 'off'], 'auto'),
      haptics: bool(settings.haptics, true),
      sound: bool(settings.sound, true),
      theme: oneOf(settings.theme, ['system', 'light', 'dark'], 'system'),
    },
    daily: cleanDaily(r.daily),
    missions: int(r.missions, 0, 1e7, 0),
    counters: cleanCounters(r.counters),
  };
  if (int(r.v, 1, SCHEMA, 1) >= 2) {
    out.profile = cleanProfile(r.profile, name);
    out.meta = {
      schema: SCHEMA,
      createdAt: ts(meta.createdAt),
      updatedAt: ts(meta.updatedAt),
      appVersion: str(meta.appVersion, 20, APP_VERSION),
    };
    out.tracks = safeMap(r.tracks, 1000, (k) => !!id(k), (t) => {
      if (!isObj(t)) return undefined;
      const o = { bossPassed: bool(t.bossPassed), bestScore: num(t.bestScore, 0, 100, 0) };
      if (t.completed === true) o.completed = true;
      if (t.completedAt !== undefined) o.completedAt = ts(t.completedAt);
      return o;
    });
  }
  return out;
}

// ---------- export / import ----------

export function exportData(state, now = Date.now()) {
  const clean = migrate(sanitizeState(migrate(state)));
  return JSON.stringify({ app: APP_ID, schema: SCHEMA, exportedAt: new Date(now).toISOString(), state: clean }, null, 2);
}

function byteLength(text) {
  try {
    return new TextEncoder().encode(text).length;
  } catch {
    return text.length * 3;
  }
}

// Keep only ids that exist in the given content lists (when a list is given).
function filterKnown(st, { items, badges, tracks } = {}) {
  if (Array.isArray(items) && items.length) {
    const known = new Set(items.map((it) => it && it.id));
    for (const k of Object.keys(st.items)) if (!known.has(k)) delete st.items[k];
    st.history = st.history.filter((e) => known.has(e.itemId));
  }
  if (Array.isArray(badges) && badges.length) {
    const known = new Set(badges.map((b) => b && b.id));
    st.badges = st.badges.filter((b) => known.has(b));
  }
  if (Array.isArray(tracks) && tracks.length && st.tracks) {
    const known = new Set(tracks.flatMap((t) => (t && Array.isArray(t.units) ? t.units.map((u) => u && u.id) : [])));
    for (const k of Object.keys(st.tracks)) if (!known.has(k)) delete st.tracks[k];
  }
  return st;
}

/**
 * Parse and validate an export. Pure: never touches storage, so the current
 * state stays untouched when it throws. Throws Error with a Hebrew message.
 * @param {string} text  the pasted JSON
 * @param {{ now?: number, items?: object[], badges?: object[], tracks?: object[] }} [opts]
 *   content lists, when given, drop ids that do not exist in them
 * @returns {object} a validated, migrated v2 state
 */
export function importData(text, opts = {}) {
  const o = isObj(opts) ? opts : {};
  const now = Number.isFinite(o.now) ? o.now : Date.now();
  if (typeof text !== 'string' || !text.trim()) throw new Error(ERR_HE.empty);
  if (text.length > MAX_IMPORT_BYTES || byteLength(text) > MAX_IMPORT_BYTES) throw new Error(ERR_HE.tooBig);
  let parsed;
  try {
    // The reviver drops keys that could pollute prototypes, at every level.
    parsed = JSON.parse(text, (k, v) => (k === '' || isSafeKey(k) ? v : undefined));
  } catch {
    throw new Error(ERR_HE.badJson);
  }
  if (!isObj(parsed)) throw new Error(ERR_HE.badShape);
  if (parsed.app !== APP_ID) throw new Error(ERR_HE.notOurs);
  const schema = Number(parsed.schema);
  if (Number.isFinite(schema) && schema > SCHEMA) throw new Error(ERR_HE.tooNew);
  if (!KNOWN_SCHEMAS.includes(parsed.schema)) throw new Error(ERR_HE.badShape);
  const raw = parsed.state;
  if (!isObj(raw)) throw new Error(ERR_HE.badShape);
  if (Number(raw.v) > SCHEMA) throw new Error(ERR_HE.tooNew);
  let out;
  try {
    out = ensureIdentity(filterKnown(sanitizeState(raw), o), now);
  } catch {
    throw new Error(ERR_HE.badShape);
  }
  return out;
}

// ---------- adapters ----------

// Local adapter over createStore (localStorage by default).
export function createLocalAdapter(storage) {
  const store = createStore(storage);
  return {
    load: () => store.get(),
    save: (state) => store.set(() => state),
    clear: () => store.reset(),
  };
}

// ---------- anonymous summary ----------

// Small anonymous object for future opt-in telemetry. No name, no id, no dates,
// no item ids, no text. Not sent anywhere.
export function summary(state, ITEMS, TRACKS) {
  const s = migrate(state);
  const st = stats(s, ITEMS, TRACKS);
  return {
    app: APP_ID,
    schema: SCHEMA,
    appVersion: APP_VERSION,
    level: levelFromXp(s.xp, []).level,
    xp: s.xp,
    streak: s.streak.count || 0,
    bestStreak: st.bestStreak,
    activeDays: st.activeDays,
    sessions: st.sessions,
    avgScore: st.avgScore,
    minutesTotal: st.minutesTotal,
    wordsSpoken: st.wordsSpoken,
    unitsDone: Object.values(s.tracks || {}).filter((t) => t && t.completed === true).length,
    tracksDone: st.tracksDone,
    badges: (s.badges || []).length,
    categories: Object.keys(st.accuracyByCat).length,
    dailyGoalMin: s.profile.dailyGoalMin,
    onDevice: s.settings.onDevice,
  };
}
