import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportData, importData, createLocalAdapter, summary, sanitizeState, ERR_HE, MAX_IMPORT_BYTES, APP_ID } from '../js/data.js';
import { defaultState, completePractice, createStore, STORE_KEY, UUID_RE, HISTORY_CAP, ensureIdentity } from '../js/engine.js';

const ITEMS = [
  { id: 'fx-0', cat: 'grammar', type: 'fix' },
  { id: 'fx-1', cat: 'grammar', type: 'fix' },
  { id: 'sp-0', cat: 'speaking', type: 'speak', seconds: 60 },
  { id: 'qa-0', cat: 'qa', type: 'qa' },
];
const TRACKS = [{ id: 'tr', units: [{ id: 'u1', itemIds: ['fx-0', 'fx-1'], bossId: 'qa-0' }] }];
const BADGES = [{ id: 'b-unit-1', rule: 'unit:1' }];
const XSS = '<img src=x onerror=alert(1)>';

function mem() {
  const m = new Map();
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

function playedState() {
  let s = ensureIdentity(defaultState(), 1000);
  s.name = 'Alex';
  s.profile.name = 'Alex';
  s.profile.role = 'engineer';
  s.profile.goals = ['talks'];
  s.profile.nextTalkDate = '2026-12-01';
  s.settings.theme = 'dark';
  const now = new Date(2026, 9, 21, 12).getTime();
  s = completePractice(s, 'unit:u1', [
    { itemId: 'fx-0', score: 90 },
    { itemId: 'fx-1', score: 80 },
    { itemId: 'qa-0', score: 85, metrics: { words: 80, wpm: 120, durationSec: 40, fromMic: true, fillers: { so: 1 } } },
  ], now, { items: ITEMS, tracks: TRACKS, badges: BADGES }).state;
  return s;
}

const wrap = (state, extra = {}) => JSON.stringify({ app: APP_ID, schema: 2, exportedAt: 'x', state, ...extra });
const throwsHe = (fn, msg) => assert.throws(fn, (e) => e instanceof Error && e.message === msg);

test('exportData: envelope shape, pretty JSON, no transcript or audio', () => {
  const s = playedState();
  s.history[0].metrics.transcript = 'secret words';
  s.history[0].metrics.audioUrl = 'blob:abc';
  const text = exportData(s, Date.UTC(2026, 9, 21));
  assert.ok(text.includes('\n  "app"'));
  const o = JSON.parse(text);
  assert.equal(o.app, 'speaker-trainer');
  assert.equal(o.schema, 2);
  assert.equal(o.exportedAt, '2026-10-21T00:00:00.000Z');
  assert.equal(o.state.profile.id, s.profile.id);
  assert.ok(!/secret words|blob:abc|transcript|audioUrl/.test(text));
});

test('export -> import round trip keeps the data', () => {
  const s = playedState();
  const back = importData(exportData(s), { items: ITEMS, badges: BADGES, tracks: TRACKS });
  assert.equal(back.v, 2);
  assert.equal(back.profile.id, s.profile.id);
  assert.equal(back.name, 'Alex');
  assert.equal(back.profile.role, 'engineer');
  assert.deepEqual(back.profile.goals, ['talks']);
  assert.equal(back.profile.nextTalkDate, '2026-12-01');
  assert.equal(back.xp, s.xp);
  assert.deepEqual(back.streak, s.streak);
  assert.deepEqual(back.days, s.days);
  assert.deepEqual(back.items, s.items);
  assert.deepEqual(back.history, s.history);
  assert.deepEqual(back.badges, s.badges);
  assert.deepEqual(back.tracks, s.tracks);
  assert.deepEqual(back.counters, s.counters);
  assert.equal(back.settings.theme, 'dark');
});

test('importData: v1 state inside an envelope migrates to v2', () => {
  const v1 = { v: 1, name: 'Noa', xp: 50, items: { 'fx-0': { ease: 2.5, interval: 1, due: 1, reps: 1, lapses: 0, last: 1 } }, history: [{ date: '2026-10-20', ts: 5, taskId: 't', taskKind: 'fix', itemId: 'fx-0', cat: 'grammar', score: 77, metrics: { words: 9 } }] };
  const s = importData(JSON.stringify({ app: APP_ID, schema: 1, state: v1 }), { now: 9000 });
  assert.equal(s.v, 2);
  assert.equal(s.profile.name, 'Noa');
  assert.match(s.profile.id, UUID_RE);
  assert.equal(s.items['fx-0'].best, 77);
  assert.equal(s.counters.words, 9);
  assert.equal(s.meta.createdAt, 5);
});

test('importData: bad input gives Hebrew errors', () => {
  throwsHe(() => importData(''), ERR_HE.empty);
  throwsHe(() => importData('   '), ERR_HE.empty);
  throwsHe(() => importData(null), ERR_HE.empty);
  throwsHe(() => importData('{not json'), ERR_HE.badJson);
  throwsHe(() => importData('[1,2]'), ERR_HE.badShape);
  throwsHe(() => importData('"text"'), ERR_HE.badShape);
  throwsHe(() => importData(JSON.stringify({ xp: 5 })), ERR_HE.notOurs);
  throwsHe(() => importData(JSON.stringify({ app: 'other', schema: 2, state: {} })), ERR_HE.notOurs);
  throwsHe(() => importData(JSON.stringify({ app: APP_ID, schema: 3, state: {} })), ERR_HE.tooNew);
  throwsHe(() => importData(JSON.stringify({ app: APP_ID, schema: 'x', state: {} })), ERR_HE.badShape);
  throwsHe(() => importData(JSON.stringify({ app: APP_ID, schema: 2, state: [] })), ERR_HE.badShape);
  throwsHe(() => importData(JSON.stringify({ app: APP_ID, schema: 2, state: { v: 9 } })), ERR_HE.tooNew);
  for (const msg of Object.values(ERR_HE)) assert.match(msg, /[֐-׿]/);
});

test('importData: huge input is refused before parsing', () => {
  const big = '{"app":"speaker-trainer","schema":2,"state":{"name":"' + 'a'.repeat(5 * 1024 * 1024) + '"}}';
  throwsHe(() => importData(big), ERR_HE.tooBig);
  // multi-byte text over the byte cap but under the char cap
  const heb = 'א'.repeat(Math.floor(MAX_IMPORT_BYTES / 2) + 10);
  throwsHe(() => importData(heb), ERR_HE.tooBig);
});

test('importData: prototype pollution attempt is ignored', () => {
  const text = `{"app":"speaker-trainer","schema":2,"__proto__":{"polluted":1},"state":{"v":2,"xp":5,"__proto__":{"polluted":2},"constructor":{"prototype":{"polluted":3}},"items":{"__proto__":{"ease":9},"fx-0":{"ease":2,"prototype":1}},"counters":{"cats":{"__proto__":5,"constructor":5,"grammar":2}},"tracks":{"__proto__":{"bossPassed":true}}}}`;
  const s = importData(text);
  assert.equal({}.polluted, undefined);
  assert.equal(Object.prototype.polluted, undefined);
  assert.equal(Object.getPrototypeOf(s), Object.prototype);
  assert.equal(Object.hasOwn(s, '__proto__'), false);
  assert.equal(Object.hasOwn(s, 'constructor'), false);
  assert.deepEqual(Object.keys(s.items), ['fx-0']);
  assert.equal(Object.hasOwn(s.items['fx-0'], 'prototype'), false);
  assert.deepEqual(s.counters.cats, { grammar: 2 });
  assert.deepEqual(s.tracks, {});
  assert.equal(s.xp, 5);
});

test('importData: transcript, audio and unknown fields are stripped', () => {
  const state = {
    v: 2,
    xp: 1,
    secretField: 'x',
    transcript: 'top level text',
    history: [{ date: '2026-10-20', ts: 1, taskId: 't', taskKind: 'speak', itemId: 'sp-0', cat: 'speaking', score: 80, transcript: 'hello there', audio: 'data:audio/webm;base64,AAAA', note: 'x', metrics: { words: 3, transcript: 'hello there', audioUrl: 'blob:x', audioBlob: 'AAAA', beDrops: [{ text: 'we gonna' }], fillers: { so: 1, transcript: 2 } } }],
  };
  const s = importData(wrap(state));
  const text = JSON.stringify(s);
  assert.ok(!/hello there|top level text|audio|blob:|we gonna|secretField|"note"/.test(text), text);
  assert.deepEqual(s.history[0].metrics, { words: 3, beDrops: 1, fillers: { so: 1, transcript: 2 } });
});

test('importData: hostile element types (F2)', () => {
  const state = {
    v: 2,
    xp: XSS,
    name: XSS + XSS + XSS,
    days: ['2026-10-20', XSS, 3],
    badges: ['b-unit-1', 7, XSS],
    unknownTop: { a: 1 },
    daily: { date: '2026-10-21', tasks: [{ id: 'a', kind: 'fix', itemIds: ['fx-0'], xp: XSS, minutes: 2 }], done: [], bonus: false },
    history: [
      ...Array.from({ length: 700 }, (_, i) => ({ date: '2026-10-20', ts: i, taskId: 't', taskKind: 'fix', itemId: 'fx-0', score: 50, metrics: {} })),
      { date: '2026-10-20', itemId: XSS, score: 50 },
      { date: '2026-10-20', itemId: 'fx-0', score: 1e9 },
    ],
    profile: { id: 'not-a-uuid', name: XSS, dailyGoalMin: -5, goals: 'x', audiences: [XSS, 'devs'] },
    tracks: { u1: { bossPassed: 1, bestScore: 900 } },
  };
  const s = importData(wrap(state), { items: ITEMS, badges: BADGES, tracks: TRACKS });
  assert.equal(s.xp, 0);
  assert.ok(s.name.length <= 24);
  assert.ok(s.profile.name.length <= 24);
  assert.deepEqual(s.days, ['2026-10-20']);
  assert.deepEqual(s.badges, ['b-unit-1']);
  assert.equal(s.unknownTop, undefined);
  assert.deepEqual(s.daily, defaultState().daily);
  assert.ok(s.history.length <= HISTORY_CAP);
  assert.ok(s.history.every((e) => e.itemId === 'fx-0' && e.score >= 0 && e.score <= 100));
  assert.equal(s.history[s.history.length - 1].score, 100);
  assert.match(s.profile.id, UUID_RE);
  assert.notEqual(s.profile.id, 'not-a-uuid');
  assert.equal(s.profile.dailyGoalMin, 1);
  assert.deepEqual(s.profile.goals, []);
  assert.deepEqual(s.profile.audiences, ['devs']);
  assert.deepEqual(s.tracks, { u1: { bossPassed: false, bestScore: 100 } });
});

test('importData: unknown item, badge and unit ids are dropped when content is given', () => {
  const state = {
    v: 2,
    items: { 'fx-0': { ease: 2.5 }, 'zz-9': { ease: 2.5 } },
    history: [
      { date: '2026-10-20', itemId: 'fx-0', score: 50 },
      { date: '2026-10-20', itemId: 'zz-9', score: 50 },
    ],
    badges: ['b-unit-1', 'b-made-up'],
    tracks: { u1: { bossPassed: true }, 'u-fake': { bossPassed: true } },
  };
  const s = importData(wrap(state), { items: ITEMS, badges: BADGES, tracks: TRACKS });
  assert.deepEqual(Object.keys(s.items), ['fx-0']);
  assert.deepEqual(s.history.map((e) => e.itemId), ['fx-0']);
  assert.deepEqual(s.badges, ['b-unit-1']);
  assert.deepEqual(Object.keys(s.tracks), ['u1']);
});

test('importData failure leaves stored state untouched', () => {
  const storage = mem();
  const adapter = createLocalAdapter(storage);
  adapter.save(playedState());
  const before = storage.m.get(STORE_KEY);
  for (const bad of ['{x', '[]', JSON.stringify({ app: 'nope' }), 'a'.repeat(MAX_IMPORT_BYTES + 1)]) {
    try {
      adapter.save(importData(bad));
    } catch {
      /* expected */
    }
  }
  assert.equal(storage.m.get(STORE_KEY), before);
});

test('createLocalAdapter: load, save, clear', () => {
  const storage = mem();
  const a = createLocalAdapter(storage);
  assert.equal(a.load().xp, 0);
  const s = playedState();
  a.save(s);
  assert.equal(createLocalAdapter(storage).load().xp, s.xp);
  assert.equal(createStore(storage).get().profile.id, s.profile.id);
  a.clear();
  assert.equal(storage.m.has(STORE_KEY), false);
  assert.equal(a.load().xp, 0);
});

test('summary is anonymous and small', () => {
  const s = playedState();
  const sum = summary(s, ITEMS, TRACKS);
  const text = JSON.stringify(sum);
  assert.ok(!text.includes(s.profile.id));
  assert.ok(!text.includes('Alex'));
  assert.ok(!text.includes('engineer'));
  assert.ok(!/fx-0|qa-0|2026-/.test(text));
  assert.equal(sum.xp, s.xp);
  assert.equal(sum.unitsDone, 1);
  assert.equal(sum.tracksDone, 1);
  assert.equal(sum.wordsSpoken, 80);
  assert.ok(text.length < 600);
  assert.equal(summary(undefined).xp, 0);
});

test('sanitizeState never throws on junk', () => {
  for (const junk of [null, 1, 'x', [], { history: 'x', items: [], daily: 5, profile: [] }]) {
    assert.doesNotThrow(() => sanitizeState(junk));
  }
});

test('no eval or Function in data and engine sources', async () => {
  const fs = await import('node:fs');
  for (const f of ['js/data.js', 'js/engine.js']) {
    const src = fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    assert.ok(!/\beval\s*\(|new Function\s*\(/.test(src), f);
  }
});
