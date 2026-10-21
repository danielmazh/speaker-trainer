import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  todayStr,
  seededRandom,
  createStore,
  defaultState,
  levelFromXp,
  xpForLevel,
  generateDaily,
  ensureDaily,
  grade,
  scoreToQuality,
  completeTask,
  checkRule,
  evaluateBadges,
  stats,
  addDays,
  endOfDay,
  STORE_KEY,
  DAY_MS,
  SCHEMA,
  migrate,
  ensureIdentity,
  uuidv4,
  UUID_RE,
  trackProgress,
  buildUnitSession,
  completePractice,
  cleanMetrics,
  entryMinutes,
} from '../js/engine.js';

// ---------- fixture in CONTRACT shape ----------
const CATS = ['grammar', 'pronoun', 'phrasing', 'fillers', 'speaking'];
const ITEMS = [];
for (let i = 0; i < 6; i++) ITEMS.push({ id: `sh-${i}`, cat: 'pronunciation', type: 'shadow', level: 1, word: `w${i}`, hint_he: 'x', sentence_en: 'x' });
for (let i = 0; i < 10; i++) ITEMS.push({ id: `fx-${i}`, cat: CATS[i % CATS.length], type: 'fix', level: 1 + (i % 3), wrong: 'a', right: 'b', note_he: 'x' });
for (let i = 0; i < 10; i++) ITEMS.push({ id: `ch-${i}`, cat: CATS[i % CATS.length], type: 'choice', level: 1, wrong: 'a', options: ['a', 'b'], correct: 1, note_he: 'x' });
for (let i = 0; i < 4; i++) ITEMS.push({ id: `sp-${i}`, cat: 'speaking', type: 'speak', level: 1, title_he: 'x', prompt_en: 'x', seconds: 60, must: [], banned: [], model_en: 'x', bad: 'x' });
for (let i = 0; i < 3; i++) ITEMS.push({ id: `qa-${i}`, cat: 'qa', type: 'qa', level: 2, question_en: 'q', model_en: 'm', note_he: 'x' });
for (let i = 0; i < 3; i++) ITEMS.push({ id: `rc-${i}`, cat: 'scripts', type: 'recall', level: 2, title_he: 'x', text_en: 't' });
const LONG_DASH = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']');
const TITLES = ['מתחיל', 'מדבר', 'נואם'];

const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();
const withDaily = (state, date) => ensureDaily(state, ITEMS, date);
const task = (s, kind) => s.daily.tasks.find((t) => t.kind === kind);
const res = (t, score = 70, metrics = {}) => t.itemIds.map((itemId) => ({ itemId, score, metrics }));

// ---------- basics ----------
test('todayStr is local YYYY-MM-DD', () => {
  assert.equal(todayStr(new Date(2026, 0, 5, 23, 30)), '2026-01-05');
  assert.equal(addDays('2026-01-31', 1), '2026-02-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
});

test('seededRandom is deterministic and in range', () => {
  const a = seededRandom('x');
  const b = seededRandom('x');
  const c = seededRandom('y');
  const va = [a(), a(), a()];
  assert.deepEqual(va, [b(), b(), b()]);
  assert.notDeepEqual(va, [c(), c(), c()]);
  va.forEach((v) => assert.ok(v >= 0 && v < 1));
});

test('no em dash or en dash in engine source', async () => {
  const fs = await import('node:fs');
  for (const f of ['js/engine.js', 'tests/engine.test.mjs', 'js/data.js', 'tests/data.test.mjs']) {
    const src = fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    assert.ok(!LONG_DASH.test(src), f);
  }
});

// ---------- daily generation ----------
test('generateDaily: shape, 5 tasks, xp, ids', () => {
  const d = generateDaily(defaultState(), ITEMS, '2026-10-21');
  assert.equal(d.date, '2026-10-21');
  assert.deepEqual(d.tasks.map((t) => t.kind), ['warmup', 'fix', 'choice', 'speak', 'boss']);
  assert.deepEqual(d.tasks.map((t) => t.id), [1, 2, 3, 4, 5].map((n) => `2026-10-21-${n}`));
  assert.deepEqual(d.tasks.map((t) => t.xp), [20, 30, 30, 50, 70]);
  const w = d.tasks[0].itemIds.length;
  assert.ok(w >= 2 && w <= 3);
  assert.equal(d.tasks[1].itemIds.length, 4);
  assert.equal(d.tasks[2].itemIds.length, 4);
  assert.equal(d.tasks[3].itemIds.length, 1);
  assert.equal(d.tasks[4].itemIds.length, 1);
  const total = d.tasks.reduce((a, t) => a + t.minutes, 0);
  assert.ok(total >= 10 && total <= 14);
  d.tasks.forEach((t) => assert.ok(t.title_he && !LONG_DASH.test(t.title_he)));
  const byId = new Map(ITEMS.map((i) => [i.id, i]));
  assert.ok(d.tasks[0].itemIds.every((id) => byId.get(id).type === 'shadow'));
  assert.ok(d.tasks[1].itemIds.every((id) => byId.get(id).type === 'fix'));
});

test('generateDaily: deterministic for same date and state, varies by date', () => {
  const s = defaultState();
  const a = generateDaily(s, ITEMS, '2026-10-21');
  const b = generateDaily(JSON.parse(JSON.stringify(s)), ITEMS, '2026-10-21');
  assert.deepEqual(a, b);
  const days = ['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'].map((d) => generateDaily(s, ITEMS, d));
  assert.ok(days.some((d) => JSON.stringify(d.tasks.map((t) => t.itemIds)) !== JSON.stringify(a.tasks.map((t) => t.itemIds))));
});

test('generateDaily: boss alternates qa and recall by day', () => {
  const s = defaultState();
  const t1 = generateDaily(s, ITEMS, '2026-10-21').tasks[4].itemIds[0];
  const t2 = generateDaily(s, ITEMS, '2026-10-22').tasks[4].itemIds[0];
  const k = (id) => id.slice(0, 2);
  assert.notEqual(k(t1), k(t2));
  assert.ok(['qa', 'rc'].includes(k(t1)) && ['qa', 'rc'].includes(k(t2)));
});

test('generateDaily: falls back to other boss type when one is missing', () => {
  const noRecall = ITEMS.filter((i) => i.type !== 'recall');
  for (const d of ['2026-10-21', '2026-10-22']) {
    assert.ok(generateDaily(defaultState(), noRecall, d).tasks[4].itemIds[0].startsWith('qa'));
  }
});

test('generateDaily: prefers due items, then weak, then new', () => {
  const s = defaultState();
  const date = '2026-10-21';
  s.items['fx-7'] = { ease: 2.5, interval: 3, due: endOfDay(date) - 1000, reps: 2, lapses: 0, last: 0 };
  s.items['fx-8'] = { ease: 2.5, interval: 3, due: endOfDay(date) - 5000, reps: 2, lapses: 0, last: 0 };
  s.items['fx-9'] = { ease: 1.5, interval: 1, due: endOfDay(date) + 5 * DAY_MS, reps: 0, lapses: 3, last: 0 };
  // not due, healthy: should come last
  for (const id of ['fx-0', 'fx-1', 'fx-2', 'fx-3', 'fx-4', 'fx-5', 'fx-6']) {
    s.items[id] = { ease: 2.6, interval: 30, due: endOfDay(date) + 30 * DAY_MS, reps: 5, lapses: 0, last: 0 };
  }
  delete s.items['fx-6']; // one new item
  const fix = generateDaily(s, ITEMS, date).tasks[1].itemIds;
  assert.ok(fix.includes('fx-7'));
  assert.ok(fix.includes('fx-8'));
  assert.ok(fix.includes('fx-9'));
  assert.ok(fix.includes('fx-6'));
});

test('generateDaily: mixes categories', () => {
  const fix = generateDaily(defaultState(), ITEMS, '2026-10-21').tasks[1].itemIds;
  const cats = new Set(fix.map((id) => ITEMS.find((i) => i.id === id).cat));
  assert.equal(cats.size, 4);
});

test('generateDaily: never repeats the speak item two days in a row', () => {
  let s = defaultState();
  let date = '2026-10-01';
  for (let i = 0; i < 20; i++) {
    s = withDaily(s, date);
    const sp = task(s, 'speak');
    const next = addDays(date, 1);
    const tomorrow = generateDaily(s, ITEMS, next);
    assert.notEqual(tomorrow.tasks[3].itemIds[0], sp.itemIds[0], `day ${date}`);
    s = completeTask(s, sp.id, res(sp, 60), at(2026, 10, 1 + i)).state;
    date = next;
  }
});

test('generateDaily: empty or missing items is safe', () => {
  assert.deepEqual(generateDaily(defaultState(), [], '2026-10-21').tasks, []);
  assert.doesNotThrow(() => generateDaily(undefined, [{ bad: true }, null], '2026-10-21'));
});

test('ensureDaily keeps the same mission for the same date', () => {
  const s1 = withDaily(defaultState(), '2026-10-21');
  s1.daily.done.push(s1.daily.tasks[0].id);
  const s2 = withDaily(s1, '2026-10-21');
  assert.deepEqual(s2.daily.done, s1.daily.done);
  const s3 = withDaily(s1, '2026-10-22');
  assert.equal(s3.daily.date, '2026-10-22');
  assert.deepEqual(s3.daily.done, []);
});

// ---------- levels ----------
test('XP curve and levelFromXp', () => {
  assert.equal(xpForLevel(1), 0);
  assert.equal(xpForLevel(2), 100);
  assert.equal(xpForLevel(3), 300);
  assert.equal(xpForLevel(4), 600);
  assert.deepEqual(levelFromXp(0, TITLES), { level: 1, title_he: 'מתחיל', cur: 0, next: 100, pct: 0 });
  assert.equal(levelFromXp(99, TITLES).level, 1);
  const l2 = levelFromXp(150, TITLES);
  assert.equal(l2.level, 2);
  assert.equal(l2.title_he, 'מדבר');
  assert.equal(l2.cur, 50);
  assert.equal(l2.next, 200);
  assert.equal(l2.pct, 25);
  assert.equal(levelFromXp(300, TITLES).level, 3);
  assert.equal(levelFromXp(100000, TITLES).title_he, 'נואם'); // beyond titles: last one
  assert.equal(levelFromXp(5, []).title_he, 'רמה 1'); // fallback
  assert.equal(levelFromXp(-50, TITLES).level, 1);
});

// ---------- grading ----------
test('scoreToQuality mapping', () => {
  assert.deepEqual([100, 95, 90, 75, 60, 30, 0].map(scoreToQuality), [5, 5, 4, 3, 2, 1, 0]);
});

test('grade: SM-2 lite intervals, ease floor, lapses, due in ms', () => {
  const now = at(2026, 10, 21);
  let st = grade(undefined, 5, now);
  assert.equal(st.reps, 1);
  assert.equal(st.interval, 1);
  assert.equal(st.due, now + DAY_MS);
  assert.ok(st.ease > 2.5);
  st = grade(st, 4, now);
  assert.equal(st.interval, 3);
  st = grade(st, 4, now);
  assert.ok(st.interval >= 7);
  const fail = grade(st, 1, now);
  assert.equal(fail.reps, 0);
  assert.equal(fail.lapses, 1);
  assert.equal(fail.interval, 1);
  assert.ok(fail.ease < st.ease);
  let low = st;
  for (let i = 0; i < 20; i++) low = grade(low, 0, now);
  assert.equal(low.ease, 1.3);
});

// ---------- completeTask ----------
test('completeTask: XP, +20% bonus, items graded, daily done', () => {
  const s = withDaily(defaultState(), '2026-10-21');
  const fix = task(s, 'fix');
  const r1 = completeTask(s, fix.id, res(fix, 70), at(2026, 10, 21));
  assert.equal(r1.xpGained, 30);
  assert.ok(r1.state.daily.done.includes(fix.id));
  fix.itemIds.forEach((id) => assert.ok(r1.state.items[id].due > 0));
  assert.equal(r1.state.history.length, 4);
  assert.equal(r1.state.history[0].taskKind, 'fix');
  const ch = task(s, 'choice');
  const r2 = completeTask(r1.state, ch.id, res(ch, 85), at(2026, 10, 21));
  assert.equal(r2.xpGained, 36);
  assert.equal(r2.state.xp, 66);
  // input state not mutated
  assert.equal(s.xp, 0);
  assert.deepEqual(s.daily.done, []);
});

test('completeTask: repeat gives half XP, unknown task is a no-op', () => {
  const s = withDaily(defaultState(), '2026-10-21');
  const fix = task(s, 'fix');
  const r1 = completeTask(s, fix.id, res(fix, 70), at(2026, 10, 21));
  const r2 = completeTask(r1.state, fix.id, res(fix, 70), at(2026, 10, 21));
  assert.equal(r2.xpGained, 15);
  assert.equal(r2.state.daily.done.filter((id) => id === fix.id).length, 1);
  const r3 = completeTask(r1.state, 'nope', [], at(2026, 10, 21));
  assert.equal(r3.xpGained, 0);
  assert.equal(r3.state.xp, r1.state.xp);
});

test('completeTask: full mission +50 once per day', () => {
  let s = withDaily(defaultState(), '2026-10-21');
  const now = at(2026, 10, 21);
  let total = 0;
  let last;
  for (const t of s.daily.tasks) {
    last = completeTask(s, t.id, res(t, 50), now);
    s = last.state;
    total += last.xpGained;
  }
  assert.equal(total, 20 + 30 + 30 + 50 + 70 + 50);
  assert.equal(s.missions, 1);
  const again = completeTask(s, s.daily.tasks[0].id, res(s.daily.tasks[0], 50), now);
  assert.equal(again.xpGained, 10);
  assert.equal(again.state.missions, 1);
});

test('completeTask: history capped at 500', () => {
  let s = withDaily(defaultState(), '2026-10-21');
  s.history = Array.from({ length: 499 }, (_, i) => ({ date: '2026-01-01', taskKind: 'fix', itemId: `x${i}`, score: 50, metrics: {} }));
  const fix = task(s, 'fix');
  s = completeTask(s, fix.id, res(fix), at(2026, 10, 21)).state;
  assert.equal(s.history.length, 500);
  assert.equal(s.history[499].itemId, fix.itemIds[3]);
});

// ---------- streak ----------
function playOn(s, y, m, d, h = 12) {
  const date = todayStr(new Date(y, m - 1, d, h));
  s = withDaily(s, date);
  const t = s.daily.tasks.find((x) => !s.daily.done.includes(x.id)) || s.daily.tasks[0];
  return completeTask(s, t.id, res(t), at(y, m, d, h));
}

test('streak: first day, same day, next day, gap', () => {
  let r = playOn(defaultState(), 2026, 10, 20);
  assert.equal(r.state.streak.count, 1);
  assert.equal(r.streakUp, true);
  r = playOn(r.state, 2026, 10, 20, 18);
  assert.equal(r.state.streak.count, 1);
  assert.equal(r.streakUp, false);
  r = playOn(r.state, 2026, 10, 21);
  assert.equal(r.state.streak.count, 2);
  assert.equal(r.streakUp, true);
  r = playOn(r.state, 2026, 10, 23);
  assert.equal(r.state.streak.count, 1);
  assert.equal(r.state.streak.best, 2);
  assert.deepEqual(r.state.days, ['2026-10-20', '2026-10-21', '2026-10-23']);
});

test('streak: month and year boundaries, late night then early morning', () => {
  let r = playOn(defaultState(), 2026, 1, 31, 23);
  r = playOn(r.state, 2026, 2, 1, 0);
  assert.equal(r.state.streak.count, 2);
  r = playOn(r.state, 2026, 2, 28);
  assert.equal(r.state.streak.count, 1);
  r = playOn(r.state, 2026, 3, 1);
  assert.equal(r.state.streak.count, 2);
  let y = playOn(defaultState(), 2026, 12, 31);
  y = playOn(y.state, 2027, 1, 1);
  assert.equal(y.state.streak.count, 2);
});

// ---------- badges ----------
test('checkRule: each rule key', () => {
  const s = defaultState();
  s.xp = 350;
  s.streak = { count: 3, last: '2026-10-21', best: 5 };
  s.missions = 2;
  s.counters = { fillerFree: 1, perfect: 4, boss: 2, graded: 9, mic: 1, nightOwl: 0, earlyBird: 1, cats: { grammar: 7 } };
  const yes = ['streak:5', 'xp:350', 'level:3', 'fillerfree:1', 'perfect:4', 'cat:grammar:7', 'boss:2', 'first_mic', 'early_bird', 'mission:2'];
  const no = ['streak:6', 'xp:351', 'level:4', 'fillerfree:2', 'perfect:5', 'cat:grammar:8', 'cat:qa:1', 'boss:3', 'night_owl', 'mission:3'];
  yes.forEach((r) => assert.equal(checkRule(r, s), true, r));
  no.forEach((r) => assert.equal(checkRule(r, s), false, r));
  for (const bad of ['', 'what', 'xp', 'xp:abc', 'xp:-1', 'cat:grammar', 'streak:1:2', 'first_mic:3', null, 42, {}]) {
    assert.equal(checkRule(bad, s), false, String(bad));
  }
});

test('evaluateBadges skips owned and broken badges', () => {
  const s = defaultState();
  s.xp = 500;
  s.badges = ['b1'];
  const BADGES = [
    { id: 'b1', rule: 'xp:10' },
    { id: 'b2', rule: 'xp:100' },
    { id: 'b3', rule: 'unknown:rule' },
    null,
    { rule: 'xp:1' },
    { id: 'b4', rule: undefined },
  ];
  assert.deepEqual(evaluateBadges(s, BADGES), ['b2']);
});

test('completeTask awards badges from results and time of day', () => {
  const BADGES = [
    { id: 'mic', rule: 'first_mic' },
    { id: 'owl', rule: 'night_owl' },
    { id: 'bird', rule: 'early_bird' },
    { id: 'clean', rule: 'fillerfree:1' },
    { id: 'perf', rule: 'perfect:1' },
    { id: 'boss', rule: 'boss:1' },
    { id: 'mission', rule: 'mission:1' },
    { id: 'cat', rule: 'cat:speaking:1' },
    { id: 'junk', rule: 'not-a-rule' },
  ];
  const opts = { badges: BADGES, items: ITEMS };
  let s = withDaily(defaultState(), '2026-10-21');
  const sp = task(s, 'speak');
  let r = completeTask(s, sp.id, res(sp, 96, { fillerTotal: 0, fromMic: true }), at(2026, 10, 21, 23), opts);
  assert.deepEqual(r.newBadges.sort(), ['cat', 'clean', 'mic', 'owl', 'perf']);
  s = r.state;
  const boss = task(s, 'boss');
  r = completeTask(s, boss.id, res(boss, 50), at(2026, 10, 21, 6), opts);
  assert.deepEqual(r.newBadges.sort(), ['bird', 'boss']);
  s = r.state;
  for (const t of s.daily.tasks.filter((t) => !s.daily.done.includes(t.id))) {
    r = completeTask(s, t.id, res(t, 50), at(2026, 10, 21, 14), opts);
    s = r.state;
  }
  assert.deepEqual(r.newBadges, ['mission']);
  assert.equal(new Set(s.badges).size, s.badges.length);
});

test('fillerfree only counts speak results with fillerTotal 0', () => {
  const s = withDaily(defaultState(), '2026-10-21');
  const fix = task(s, 'fix');
  const r = completeTask(s, fix.id, res(fix, 50, { fillerTotal: 0 }), at(2026, 10, 21));
  assert.equal(r.state.counters.fillerFree, 0);
});

// ---------- stats ----------
test('stats', () => {
  let s = withDaily(defaultState(), '2026-10-21');
  const sp = task(s, 'speak');
  const fix = task(s, 'fix');
  s = completeTask(s, sp.id, res(sp, 80, { fillersPerMin: 4 }), at(2026, 10, 21), { items: ITEMS }).state;
  s = completeTask(s, fix.id, res(fix, 60), at(2026, 10, 21), { items: ITEMS }).state;
  s.history.push({ date: '2026-10-22', taskId: 'x', taskKind: 'speak', itemId: 'sp-1', cat: 'speaking', score: 90, metrics: { fillerTotal: 3, durationSec: 60 } });
  const st = stats(s);
  assert.equal(st.totalXp, s.xp);
  assert.equal(st.sessions, 3);
  assert.equal(st.avgScore, Math.round((80 + 60 * 4 + 90) / 6));
  assert.deepEqual(st.fillersPerMinTrend, [4, 3]);
  assert.equal(st.bestStreak, 1);
  assert.equal(st.mastered, 0);
  const sk = s.history.filter((e) => e.cat === 'speaking');
  assert.equal(st.byCat.speaking.count, sk.length);
  assert.equal(st.byCat.speaking.avg, Math.round(sk.reduce((a, e) => a + e.score, 0) / sk.length));
  assert.equal(st.byCat.pronunciation, undefined);
  assert.deepEqual(stats(undefined).fillersPerMinTrend, []);
});

// ---------- store ----------
function mem(initial) {
  const m = new Map(initial ? [[STORE_KEY, initial]] : []);
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

test('store: defaults, patch, fn, reset, persistence', () => {
  const storage = mem();
  const st = createStore(storage);
  assert.deepEqual(st.get(), defaultState());
  st.set({ name: 'Alex', settings: { sound: false } });
  assert.equal(st.get().name, 'Alex');
  assert.equal(st.get().settings.sound, false);
  assert.equal(st.get().settings.haptics, true);
  st.set((s) => ({ ...s, xp: s.xp + 10 }));
  st.set((s) => {
    s.onboarded = true;
    return s;
  });
  const again = createStore(storage).get();
  assert.equal(again.xp, 10);
  assert.equal(again.onboarded, true);
  assert.equal(again.name, 'Alex');
  st.reset();
  assert.equal(storage.m.has(STORE_KEY), false);
  assert.equal(st.get().xp, 0);
});

test('store: broken JSON and wrong types fall back to defaults', () => {
  assert.deepEqual(createStore(mem('{not json')).get(), defaultState());
  assert.deepEqual(createStore(mem('null')).get(), defaultState());
  assert.deepEqual(createStore(mem('[1,2]')).get(), defaultState());
  const s = createStore(mem(JSON.stringify({ xp: 'lots', streak: 5, badges: 'x', settings: { theme: 'dark' } }))).get();
  assert.equal(s.xp, 0);
  assert.deepEqual(s.streak, defaultState().streak);
  assert.deepEqual(s.badges, []);
  assert.equal(s.settings.theme, 'dark');
  assert.equal(s.settings.sound, true);
});

test('store: old save upgrades with new keys', () => {
  const old = { v: 1, name: 'Alex', xp: 120, streak: { count: 2, last: '2026-10-20' }, items: { 'fx-1': { ease: 2, interval: 1, due: 5, reps: 1, lapses: 0, last: 1 } } };
  const s = createStore(mem(JSON.stringify(old))).get();
  assert.equal(s.xp, 120);
  assert.equal(s.streak.count, 2);
  assert.equal(s.streak.best, 0);
  assert.deepEqual(s.counters.cats, {});
  assert.equal(s.items['fx-1'].ease, 2);
  assert.equal(s.missions, 0);
});

test('store: throwing storage never throws', () => {
  const bad = {
    getItem() {
      throw new Error('denied');
    },
    setItem() {
      throw new Error('quota');
    },
    removeItem() {
      throw new Error('denied');
    },
  };
  const st = createStore(bad);
  assert.deepEqual(st.get(), defaultState());
  assert.doesNotThrow(() => st.set({ xp: 5 }));
  assert.equal(st.get().xp, 5);
  assert.doesNotThrow(() => st.reset());
  assert.doesNotThrow(() => createStore(null).set({ xp: 1 }));
  assert.doesNotThrow(() => createStore().get());
});

// ---------- phase 3: schema v2 ----------

const V1 = {
  v: 1,
  name: 'Alex',
  onboarded: true,
  xp: 420,
  streak: { count: 3, last: '2026-10-20', best: 5 },
  days: ['2026-10-19', '2026-10-20'],
  items: { 'fx-1': { ease: 2.2, interval: 3, due: 5, reps: 2, lapses: 1, last: 1 } },
  history: [
    { date: '2026-10-20', ts: 1000, taskId: 't1', taskKind: 'fix', itemId: 'fx-1', cat: 'grammar', score: 65, metrics: {} },
    { date: '2026-10-20', ts: 2000, taskId: 't1', taskKind: 'fix', itemId: 'fx-1', cat: 'grammar', score: 85, metrics: {} },
    { date: '2026-10-20', ts: 3000, taskId: 't2', taskKind: 'speak', itemId: 'sp-1', cat: 'speaking', score: 70, metrics: { words: 120, durationSec: 90 } },
  ],
  badges: ['b-first-mic'],
  settings: { onDevice: 'off', haptics: false, sound: true, theme: 'dark' },
  daily: { date: '2026-10-20', tasks: [], done: [], bonus: false },
  missions: 2,
  counters: { fillerFree: 1, perfect: 0, boss: 1, graded: 3, mic: 1, nightOwl: 0, earlyBird: 0, cats: { grammar: 2, speaking: 1 } },
  custom: { keep: true },
};

test('defaultState is v2 with profile, meta, tracks', () => {
  const d = defaultState();
  assert.equal(d.v, 2);
  assert.equal(SCHEMA, 2);
  assert.equal(d.meta.schema, 2);
  assert.deepEqual(d.tracks, {});
  assert.equal(d.profile.nativeLang, 'he');
  assert.equal(d.profile.dailyGoalMin, 10);
  assert.equal(d.profile.nextTalkDate, null);
  assert.deepEqual(defaultState(), defaultState());
});

test('migrate v1 -> v2 keeps all data and derives counters', () => {
  const s = migrate(V1, ITEMS);
  assert.equal(s.v, 2);
  assert.equal(s.meta.schema, 2);
  assert.equal(s.name, 'Alex');
  assert.equal(s.profile.name, 'Alex');
  assert.equal(s.xp, 420);
  assert.deepEqual(s.streak, V1.streak);
  assert.deepEqual(s.days, V1.days);
  assert.equal(s.history.length, 3);
  assert.deepEqual(s.badges, ['b-first-mic']);
  assert.equal(s.settings.theme, 'dark');
  assert.equal(s.missions, 2);
  assert.deepEqual(s.counters.cats, { grammar: 2, speaking: 1 });
  assert.deepEqual(s.custom, { keep: true });
  assert.equal(s.items['fx-1'].best, 85);
  assert.equal(s.items['fx-1'].ease, 2.2);
  assert.equal(s.counters.words, 120);
  // fix 0.5 + fix 0.5 + speak 90s = 2.5
  assert.equal(s.counters.minutes, 2.5);
  assert.equal(s.meta.createdAt, 1000);
  assert.equal(s.profile.id, null);
  assert.deepEqual(s.tracks, {});
  // migrating twice changes nothing
  assert.deepEqual(migrate(s, ITEMS), s);
});

test('ensureIdentity adds uuid v4 and timestamps once', () => {
  const s = ensureIdentity(V1, 5000);
  assert.match(s.profile.id, UUID_RE);
  assert.equal(s.meta.createdAt, 1000);
  assert.equal(s.profile.createdAt, 1000);
  const again = ensureIdentity(s, 9000);
  assert.equal(again.profile.id, s.profile.id);
  const fresh = ensureIdentity({}, 7000);
  assert.equal(fresh.profile.createdAt, 7000);
  assert.equal(fresh.meta.createdAt, 7000);
});

test('uuidv4 format, with and without crypto.randomUUID', () => {
  const ids = new Set(Array.from({ length: 50 }, () => uuidv4()));
  assert.equal(ids.size, 50);
  ids.forEach((u) => assert.match(u, UUID_RE));
  const desc = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  try {
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true, writable: true });
    const u = uuidv4();
    assert.match(u, UUID_RE);
  } finally {
    Object.defineProperty(globalThis, 'crypto', desc);
  }
});

test('store upgrades a v1 save on load and writes it back', () => {
  const storage = mem(JSON.stringify(V1));
  const s = createStore(storage).get();
  assert.equal(s.v, 2);
  assert.match(s.profile.id, UUID_RE);
  assert.equal(s.xp, 420);
  const saved = JSON.parse(storage.m.get(STORE_KEY));
  assert.equal(saved.v, 2);
  assert.equal(saved.profile.id, s.profile.id);
  // id is stable across reloads
  assert.equal(createStore(storage).get().profile.id, s.profile.id);
});

test('store set keeps name and profile.name in step and stamps meta', () => {
  const storage = mem();
  const st = createStore(storage);
  st.set({ name: 'Alex' });
  assert.equal(st.get().profile.name, 'Alex');
  assert.match(st.get().profile.id, UUID_RE);
  assert.ok(st.get().meta.updatedAt > 0);
  st.set({ profile: { name: 'Noa', dailyGoalMin: 15 } });
  assert.equal(st.get().name, 'Noa');
  assert.equal(st.get().profile.dailyGoalMin, 15);
  st.set(JSON.parse('{"__proto__":{"polluted":1}}'));
  assert.equal({}.polluted, undefined);
});

// ---------- phase 3: tracks ----------

const TRACKS = [
  {
    id: 'tr-a',
    title_he: 'א',
    units: [
      { id: 'u1', title_he: 'יחידה 1', itemIds: ['fx-0', 'fx-1', 'qa-0'], bossId: 'qa-0' },
      { id: 'u2', title_he: 'יחידה 2', itemIds: ['ch-0', 'ch-1'], bossId: 'sp-0' },
      { id: 'u3', title_he: 'יחידה 3', itemIds: ['fx-2'], bossId: 'rc-0' },
    ],
  },
  { id: 'tr-b', title_he: 'ב', units: [{ id: 'u4', title_he: 'x', itemIds: ['fx-3', 'missing-id'], bossId: 'qa-1' }] },
];
const unitOpts = { items: ITEMS, tracks: TRACKS };
const U = (id) => TRACKS.flatMap((t) => t.units).find((u) => u.id === id);

test('trackProgress: first unit open, rest locked', () => {
  const p = trackProgress(defaultState(), TRACKS, ITEMS);
  assert.deepEqual(Object.keys(p), ['tr-a', 'tr-b']);
  assert.equal(p['tr-a'].units.u1.status, 'open');
  assert.equal(p['tr-a'].units.u2.status, 'locked');
  assert.equal(p['tr-a'].units.u3.status, 'locked');
  assert.equal(p['tr-a'].currentUnitId, 'u1');
  assert.equal(p['tr-a'].unitsTotal, 3);
  assert.equal(p['tr-a'].unitsDone, 0);
  assert.equal(p['tr-a'].pct, 0);
  assert.equal(p['tr-b'].units.u4.status, 'open');
});

test('trackProgress: unit done needs every item >= 70 and boss passed; next opens', () => {
  const s = defaultState();
  s.items['fx-0'] = { best: 90 };
  s.items['fx-1'] = { best: 69 };
  s.items['qa-0'] = { best: 80 };
  let p = trackProgress(s, TRACKS, ITEMS)['tr-a'];
  assert.equal(p.units.u1.status, 'open');
  // 2 of 3 items + boss not passed = 2/4
  assert.equal(p.units.u1.pct, 50);
  s.items['fx-1'].best = 70;
  p = trackProgress(s, TRACKS, ITEMS)['tr-a'];
  assert.equal(p.units.u1.status, 'open', 'boss flag still missing');
  s.tracks.u1 = { bossPassed: true, bestScore: 80 };
  p = trackProgress(s, TRACKS, ITEMS)['tr-a'];
  assert.equal(p.units.u1.status, 'done');
  assert.equal(p.units.u2.status, 'open');
  assert.equal(p.units.u3.status, 'locked');
  assert.equal(p.currentUnitId, 'u2');
  assert.equal(p.unitsDone, 1);
  assert.equal(p.pct, 33);
  // a later unit that meets the criteria stays locked while the one before is open
  s.items['fx-2'] = { best: 100 };
  s.tracks.u3 = { bossPassed: true, bestScore: 100 };
  assert.equal(trackProgress(s, TRACKS, ITEMS)['tr-a'].units.u3.status, 'locked');
  // missing item ids are ignored
  s.items['fx-3'] = { best: 75 };
  s.tracks.u4 = { bossPassed: true };
  assert.equal(trackProgress(s, TRACKS, ITEMS)['tr-b'].units.u4.status, 'done');
  assert.equal(trackProgress(s, TRACKS, ITEMS)['tr-b'].currentUnitId, null);
});

test('trackProgress: empty or broken tracks are safe', () => {
  assert.deepEqual(trackProgress(defaultState(), [], ITEMS), {});
  const p = trackProgress(undefined, [null, { id: 'x' }, { id: '__proto__', units: [] }], ITEMS);
  assert.deepEqual(p, { x: { pct: 0, unitsDone: 0, unitsTotal: 0, currentUnitId: null, units: {} } });
});

test('buildUnitSession: items then boss, xp estimate', () => {
  const ses = buildUnitSession(defaultState(), U('u1'), ITEMS);
  assert.equal(ses.id, 'unit:u1');
  assert.equal(ses.kind, 'unit');
  assert.equal(ses.title_he, 'יחידה 1');
  assert.deepEqual(ses.itemIds, ['fx-0', 'fx-1', 'qa-0']);
  assert.equal(ses.bossId, 'qa-0');
  assert.equal(ses.xp, 3 * 5 + 40 + 60);
  const s2 = buildUnitSession(defaultState(), U('u2'), ITEMS);
  assert.deepEqual(s2.itemIds, ['ch-0', 'ch-1', 'sp-0']);
  const s4 = buildUnitSession(defaultState(), U('u4'), ITEMS);
  assert.deepEqual(s4.itemIds, ['fx-3', 'qa-1']);
});

test('completePractice: practice session XP +5 per item >= 60, history, streak', () => {
  const now = at(2026, 10, 21, 12);
  const r = completePractice(defaultState(), 'practice:grammar', [
    { itemId: 'fx-0', score: 60 },
    { itemId: 'fx-1', score: 59 },
    { itemId: 'sp-0', score: 90, metrics: { words: 50, wpm: 120, durationSec: 30, fromMic: true, transcript: 'secret text', fillerTotal: 0 } },
  ], now, unitOpts);
  assert.equal(r.xpGained, 10);
  assert.equal(r.state.xp, 10);
  assert.equal(r.streakUp, true);
  assert.equal(r.state.streak.count, 1);
  assert.deepEqual(r.state.days, ['2026-10-21']);
  assert.equal(r.state.history.length, 3);
  assert.equal(r.state.history[0].taskKind, 'practice');
  assert.equal(r.state.history[0].taskId, 'practice:grammar');
  assert.equal(r.state.history[2].itemType, 'speak');
  assert.equal(r.state.history[2].metrics.transcript, undefined);
  assert.equal(r.state.counters.words, 50);
  assert.equal(r.state.counters.mic, 1);
  assert.equal(r.state.counters.fillerFree, 1);
  assert.equal(r.state.counters.graded, 3);
  assert.equal(r.state.items['fx-0'].best, 60);
  // 0.5 + 0.5 + 30s
  assert.equal(r.state.counters.minutes, 1.5);
  // legacy practice- prefix still works, unknown prefix and empty results are no-ops
  assert.equal(completePractice(defaultState(), 'practice-123', [{ itemId: 'fx-0', score: 80 }], now, unitOpts).xpGained, 5);
  assert.equal(completePractice(defaultState(), 'other', [{ itemId: 'fx-0', score: 80 }], now, unitOpts).xpGained, 0);
  assert.equal(completePractice(defaultState(), 'practice:x', [], now, unitOpts).state.history.length, 0);
});

test('completePractice: unit boss +40 once, unit done +60 once', () => {
  const now = at(2026, 10, 21, 12);
  let s = defaultState();
  // first run: items fine, boss fails
  let r = completePractice(s, 'unit:u1', [
    { itemId: 'fx-0', score: 80 },
    { itemId: 'fx-1', score: 75 },
    { itemId: 'qa-0', score: 50 },
  ], now, unitOpts);
  assert.equal(r.xpGained, 10);
  assert.equal(r.bossPassed, false);
  assert.equal(r.unitDone, false);
  assert.equal(r.state.tracks.u1.bossPassed, false);
  assert.equal(r.state.tracks.u1.bestScore, 68);
  assert.equal(r.state.history[0].taskKind, 'unit');
  s = r.state;
  // second run: boss passes, unit becomes done
  r = completePractice(s, 'unit:u1', [{ itemId: 'qa-0', score: 90 }], now + 1000, unitOpts);
  assert.equal(r.bossPassed, true);
  assert.equal(r.unitDone, true);
  assert.equal(r.xpGained, 5 + 40 + 60);
  assert.equal(r.state.tracks.u1.bossPassed, true);
  assert.equal(r.state.tracks.u1.completed, true);
  assert.equal(r.state.tracks.u1.bestScore, 90);
  assert.equal(r.state.counters.boss, 1);
  assert.equal(trackProgress(r.state, TRACKS, ITEMS)['tr-a'].units.u2.status, 'open');
  s = r.state;
  // third run: no more bonuses
  r = completePractice(s, 'unit:u1', [{ itemId: 'qa-0', score: 95 }], now + 2000, unitOpts);
  assert.equal(r.xpGained, 5);
  assert.equal(r.unitDone, false);
  assert.equal(r.state.counters.boss, 1);
  // unknown unit id still grades items
  r = completePractice(defaultState(), 'unit:nope', [{ itemId: 'fx-0', score: 90 }], now, unitOpts);
  assert.equal(r.xpGained, 5);
  assert.deepEqual(r.state.tracks, {});
});

test('completePractice awards badges with new rule keys', () => {
  const BADGES = [
    { id: 'b-unit-1', rule: 'unit:1' },
    { id: 'b-track-1', rule: 'track:1' },
    { id: 'b-words-100', rule: 'words:100' },
    { id: 'b-min-1', rule: 'minutes:1' },
    { id: 'b-cats-2', rule: 'cats:2' },
    { id: 'b-bad', rule: 'nope:1' },
  ];
  const now = at(2026, 10, 21, 12);
  let s = defaultState();
  let r = completePractice(s, 'unit:u4', [
    { itemId: 'fx-3', score: 80 },
    { itemId: 'qa-1', score: 80, metrics: { words: 120, durationSec: 60 } },
  ], now, { ...unitOpts, badges: BADGES });
  assert.deepEqual(r.newBadges.sort(), ['b-cats-2', 'b-min-1', 'b-track-1', 'b-unit-1', 'b-words-100']);
  assert.deepEqual(r.state.badges.sort(), r.newBadges.sort());
});

test('checkRule: phase 3 rule keys', () => {
  const s = defaultState();
  assert.equal(checkRule('unit:1', s), false);
  s.tracks.u1 = { bossPassed: true, completed: true };
  assert.equal(checkRule('unit:1', s), true);
  assert.equal(checkRule('unit:2', s), false);
  assert.equal(checkRule('words:10', s), false);
  s.counters.words = 10;
  assert.equal(checkRule('words:10', s), true);
  assert.equal(checkRule('minutes:2', s), false);
  s.counters.minutes = 2.1;
  assert.equal(checkRule('minutes:2', s), true);
  s.counters.cats = { grammar: 1, qa: 0 };
  assert.equal(checkRule('cats:1', s), true);
  assert.equal(checkRule('cats:2', s), false);
  assert.equal(checkRule('track:1', s, { tracks: TRACKS, items: ITEMS }), false);
  s.items['fx-3'] = { best: 70 };
  s.tracks.u4 = { bossPassed: true };
  assert.equal(checkRule('track:1', s, { tracks: TRACKS, items: ITEMS }), true);
  assert.equal(checkRule('track:1', s, { tracks: [], items: ITEMS }), false);
  assert.equal(checkRule('words', s), false);
  assert.equal(checkRule('words:-1', s), false);
  assert.equal(checkRule('cats:x', s), false);
});

// ---------- phase 3: stats ----------

test('cleanMetrics keeps known numbers only', () => {
  const m = cleanMetrics({ fromMic: true, words: 10, wpm: 'x', transcript: 'hi', audioUrl: 'blob:x', beDrops: [{ text: 'a' }, { text: 'b' }], fillers: { so: 2, "let's say": 1, __proto__: 5, 'bad<key>': 1 } });
  assert.deepEqual(m, { fromMic: true, words: 10, beDrops: 2, fillers: { so: 2, "let's say": 1 } });
  assert.deepEqual(cleanMetrics(null), {});
});

test('entryMinutes: duration first, else estimate by kind', () => {
  const byId = new Map(ITEMS.map((i) => [i.id, i]));
  assert.equal(entryMinutes({ itemId: 'fx-0', metrics: { durationSec: 90 } }, byId), 1.5);
  assert.equal(entryMinutes({ itemId: 'sh-0' }, byId), 0.3);
  assert.equal(entryMinutes({ itemId: 'fx-0' }, byId), 0.5);
  assert.equal(entryMinutes({ itemId: 'ch-0' }, byId), 0.3);
  assert.equal(entryMinutes({ itemId: 'sp-0' }, byId), 1); // seconds 60
  assert.equal(entryMinutes({ itemId: 'rc-0' }, byId), 1);
  assert.equal(entryMinutes({ itemId: 'qa-0' }, byId), 1);
  assert.equal(entryMinutes({ itemId: 'zz', taskKind: 'warmup' }, byId), 0.3);
  assert.equal(entryMinutes({ itemId: 'zz', itemType: 'speak' }, byId), 1);
  assert.equal(entryMinutes({ itemId: 'zz' }, byId), 0.5);
});

test('stats: extended fields', () => {
  const now = at(2026, 10, 21, 18);
  const s = defaultState();
  s.profile.dailyGoalMin = 4;
  s.days = ['2026-10-20', '2026-10-21'];
  const H = (date, taskId, itemId, cat, score, metrics = {}) => ({ date, ts: 1, taskId, taskKind: 'practice', itemId, cat, score, metrics });
  s.history = [
    H('2026-09-01', 'old', 'fx-0', 'grammar', 20),
    H('2026-10-20', 'a', 'fx-0', 'grammar', 50),
    H('2026-10-20', 'a', 'fx-1', 'pronoun', 70),
    H('2026-10-21', 'b', 'sp-0', 'speaking', 90, { words: 100, wpm: 120, durationSec: 60, fillersPerMin: 2, fillers: { so: 2, um: 1 } }),
    H('2026-10-21', 'b', 'sp-1', 'speaking', 80, { words: 50, wpm: 140, durationSec: 60, fillers: { so: 1 } }),
    H('2026-10-21', 'c', 'ch-0', 'phrasing', 100),
  ];
  const st = stats(s, ITEMS, TRACKS, now);
  // old fields still there
  for (const k of ['totalXp', 'sessions', 'avgScore', 'fillersPerMinTrend', 'bestStreak', 'mastered', 'byCat']) assert.ok(k in st, k);
  assert.equal(st.sessions, 4);
  assert.deepEqual(st.fillersPerMinTrend, [2]);
  assert.equal(st.minutesTotal, 0.5 + 0.5 + 0.5 + 1 + 1 + 0.3);
  assert.equal(st.minutesByDay.length, 30);
  assert.equal(st.minutesByDay[29].date, '2026-10-21');
  assert.equal(st.minutesByDay[0].date, '2026-09-22');
  assert.equal(st.minutesByDay[29].min, 2.3);
  assert.equal(st.minutesByDay[28].min, 1);
  assert.equal(st.todayMin, 2.3);
  assert.equal(st.goalPct, 58);
  assert.equal(st.wordsSpoken, 150);
  assert.deepEqual(st.wpmTrend, [120, 140]);
  assert.deepEqual(st.scoreTrend, [20, 60, 85, 100]);
  assert.deepEqual(st.accuracyByCat.grammar, { avg: 35, count: 2 });
  assert.deepEqual(st.weakest, ['grammar', 'pronoun', 'speaking']);
  assert.deepEqual(st.strongest, ['phrasing', 'speaking', 'pronoun']);
  assert.deepEqual(st.fillerTotals, { so: 3, um: 1 });
  assert.equal(st.activeDays, 3);
  assert.equal(st.tracksDone, 0);
  // counters win when history was trimmed
  s.counters.words = 9999;
  s.counters.minutes = 500;
  const st2 = stats(s, ITEMS, TRACKS, now);
  assert.equal(st2.wordsSpoken, 9999);
  assert.equal(st2.minutesTotal, 500);
  // goal capped at 100
  s.profile.dailyGoalMin = 1;
  assert.equal(stats(s, ITEMS, TRACKS, now).goalPct, 100);
  // tracksDone
  s.items['fx-3'] = { best: 80 };
  s.tracks.u4 = { bossPassed: true };
  assert.equal(stats(s, ITEMS, TRACKS, now).tracksDone, 1);
  const empty = stats(undefined, ITEMS, [], now);
  assert.equal(empty.minutesTotal, 0);
  assert.deepEqual(empty.weakest, []);
  assert.equal(empty.minutesByDay.every((d) => d.min === 0), true);
});

// ---------- security F1: stored state is untrusted ----------

test('F1: hostile stored state is coerced and invalid daily is reset', () => {
  const XSS = '<img src=x onerror=alert(1)>';
  const evil = {
    v: 2,
    xp: XSS,
    missions: XSS,
    streak: { count: XSS, last: XSS, best: 2 },
    days: ['2026-10-20', XSS, 5, null],
    badges: ['b-ok', { x: 1 }, XSS],
    items: { 'fx-0': { ease: XSS, interval: '3', reps: 1, best: 500 }, 'fx-1': 'nope', __proto__: { polluted: 1 } },
    history: [
      { date: '2026-10-20', taskId: 't', taskKind: 'fix', itemId: 'fx-0', cat: 'grammar', score: XSS, metrics: { words: XSS, transcript: 'hello', fillers: { so: XSS } } },
      { date: XSS, itemId: 'fx-0', score: 50 },
      { date: '2026-10-20', itemId: { a: 1 }, score: 50 },
      'junk',
    ],
    daily: { date: '2026-10-20', tasks: [{ id: 't1', kind: 'fix', itemIds: ['fx-0'], xp: XSS, minutes: 2 }], done: [], bonus: false },
    counters: { boss: XSS, cats: { grammar: XSS } },
    tracks: { u1: { bossPassed: 'yes', bestScore: XSS }, u2: 'bad' },
    profile: { id: XSS, name: XSS + XSS, goals: [XSS, 3], dailyGoalMin: XSS, nextTalkDate: XSS },
    settings: { theme: XSS, onDevice: XSS },
  };
  const s = createStore(mem(JSON.stringify(evil))).get();
  assert.equal(s.xp, 0);
  assert.equal(s.missions, 0);
  assert.equal(s.streak.count, 0);
  assert.equal(s.streak.last, null);
  assert.deepEqual(s.days, ['2026-10-20']);
  assert.deepEqual(s.daily, defaultState().daily, 'daily with a string xp is reset');
  assert.equal(s.items['fx-0'].ease, 2.5);
  assert.equal(s.items['fx-0'].interval, 3);
  assert.equal(s.items['fx-0'].best, 100);
  assert.equal(s.items['fx-1'], undefined);
  assert.equal(s.history.length, 1);
  assert.equal(s.history[0].score, 0);
  assert.deepEqual(s.history[0].metrics, { fillers: {} });
  assert.equal(s.counters.boss, 0);
  assert.equal(s.counters.cats.grammar, 0);
  assert.deepEqual(s.tracks, { u1: { bossPassed: false, bestScore: 0 } });
  assert.match(s.profile.id, UUID_RE);
  assert.ok(s.profile.name.length <= 24);
  assert.deepEqual(s.profile.goals, [XSS]); // plain text is fine, UI escapes it
  assert.equal(s.profile.dailyGoalMin, 10);
  assert.equal(s.profile.nextTalkDate, null);
  assert.equal(s.settings.theme, 'system');
  assert.equal(s.settings.onDevice, 'auto');
  assert.equal({}.polluted, undefined);
  // every number the UI may print is a real number
  for (const t of ensureDaily(s, ITEMS, '2026-10-21').daily.tasks) {
    assert.equal(typeof t.xp, 'number');
    assert.equal(typeof t.minutes, 'number');
  }
});

test('F1: daily task with unknown kind or non-string itemIds is reset; valid daily kept', () => {
  const ok = withDaily(defaultState(), '2026-10-21');
  assert.deepEqual(migrate(ok).daily, ok.daily);
  const bad1 = JSON.parse(JSON.stringify(ok));
  bad1.daily.tasks[0].kind = 'evil';
  assert.deepEqual(migrate(bad1).daily.tasks, []);
  const bad2 = JSON.parse(JSON.stringify(ok));
  bad2.daily.tasks[1].itemIds = [{ x: 1 }];
  assert.deepEqual(migrate(bad2).daily.tasks, []);
  const bad3 = JSON.parse(JSON.stringify(ok));
  bad3.daily.tasks[2].minutes = '3';
  assert.deepEqual(migrate(bad3).daily.tasks, []);
});

test('default state has no personal name; migration keeps a stored name', () => {
  const d = defaultState();
  assert.equal(d.name, '');
  assert.equal(d.profile.name, '');
  const st = createStore(mem(JSON.stringify({ v: 1, onboarded: true, name: 'Noa' })));
  assert.equal(st.get().name, 'Noa');
  assert.equal(st.get().profile.name, 'Noa');
});
