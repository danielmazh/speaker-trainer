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
  for (const f of ['js/engine.js', 'tests/engine.test.mjs']) {
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
