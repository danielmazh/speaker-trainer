import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, analyze, highlight } from '../js/analyze.js';

const drops = (t) => analyze(t, 10).beDrops.map((d) => d.text.toLowerCase());

test('tokenize keeps contractions and offsets', () => {
  const t = tokenize("Well, it's 50% done.");
  assert.deepEqual(t.map((x) => x.norm), ['well', "it's", '50%', 'done']);
  assert.equal(t[1].i, 1);
  assert.equal(t[1].boundary, true);
  assert.equal(t[2].boundary, false);
  assert.equal("Well, it's 50% done.".slice(t[3].start, t[3].end), 'done');
});

test('real line: "we gonna" is a be-drop', () => {
  assert.deepEqual(drops('Well, when we gonna add some users'), ['we gonna']);
  const r = analyze('Well, when we gonna add some users', 4);
  assert.equal(r.beDrops[0].fix, 'we are gonna');
  assert.equal(r.beDrops[0].index, 2);
});

test('real line: "both of them sharing" is a be-drop', () => {
  assert.deepEqual(drops('we can see that both of them sharing the same GPU'), ['them sharing']);
});

test('real line: fillers so, basically, uh', () => {
  const r = analyze("so basically we're selling uh what you already paid for", 6);
  assert.deepEqual(r.fillers, { so: 1, basically: 1, uh: 1 });
  assert.equal(r.fillerTotal, 3);
  assert.equal(r.beDrops.length, 0);
  assert.equal(r.fillersPerMin, 12); // 6 s is below the 15 s floor
});

test('real line: "a brain that connected" is a passive be-drop', () => {
  const r = analyze('here we have a brain that connected', 3);
  assert.equal(r.beDrops.length, 1);
  assert.equal(r.beDrops[0].text, 'that connected');
  assert.equal(r.beDrops[0].kind, 'passive');
});

test('real line: "he" for a model', () => {
  const r = analyze('I gave the model the repo and i ask him what does the project contain', 6);
  assert.equal(r.heForIt, 1);
  assert.ok(r.tips_he.some((t) => t.includes('it')));
});

test('he for a person is fine', () => {
  assert.equal(analyze('my colleague said he will help us', 3).heForIt, 0);
});

test('other be-drop patterns', () => {
  assert.deepEqual(drops('This is a feature that using the cache'), ['that using']);
  assert.deepEqual(drops('and they sharing one disk'), ['they sharing']);
  assert.deepEqual(drops('he gonna deploy it'), ['he gonna']);
  assert.deepEqual(drops('and the agent who working on it'), ['who working']);
  assert.deepEqual(drops('we still waiting'), ['we still waiting']);
  const s = analyze('because it make the model slow', 3).beDrops;
  assert.equal(s.length, 1);
  assert.equal(s[0].kind, 's');
  assert.equal(s[0].fix, 'it makes');
});

test('negatives: no false be-drops or fillers', () => {
  for (const line of [
    'I would like to show you the demo',
    'something',
    'the meeting is at ten',
    'We are using the cache',
    'I think that using the cache is faster',
    'Thank you for coming this morning',
    'It looks like the model is ready',
    'I feel like we need more time',
    'This is a kind of cache',
    'Do you know how it works',
    'we did it so that users can log in',
    'let it run for a minute',
    'the building has everything',
  ]) {
    const r = analyze(line, 5);
    assert.equal(r.beDrops.length, 0, `beDrops in: ${line}`);
    assert.equal(r.fillerTotal, 0, `fillers in: ${line} -> ${JSON.stringify(r.fillers)}`);
  }
});

test('filler variants', () => {
  const r = analyze('So, like, you know, it is kind of, um, let\'s say ready. Again. so so', 20);
  assert.equal(r.fillers.so, 3);
  assert.equal(r.fillers.like, 1);
  assert.equal(r.fillers['you know'], 1);
  assert.equal(r.fillers['kind of'], 1);
  assert.equal(r.fillers.um, 1);
  assert.equal(r.fillers["let's say"], 1);
  assert.equal(r.fillers.again, 1);
});

test('target comparison normalizes contractions, gonna and numbers', () => {
  const r = analyze("We're gonna add two users", 3, { target: 'We are going to add 2 users.' });
  assert.equal(r.targetScore, 1);
  assert.ok(r.diff.every((d) => d.status === 'ok'));
});

test('target diff marks missing and extra words', () => {
  const r = analyze('the model running on GPU', 3, { target: 'The model is running on the GPU' });
  assert.deepEqual(r.diff.filter((d) => d.status === 'miss').map((d) => d.w), ['is', 'the']);
  assert.ok(r.targetScore > 0.6 && r.targetScore < 1);
  const r2 = analyze('the big model is running', 3, { target: 'the model is running' });
  assert.deepEqual(r2.diff.filter((d) => d.status === 'extra').map((d) => d.w), ['big']);
});

test('must phrases are tolerant to case, punctuation, contractions, um', () => {
  const r = analyze("It's FAST, and um it is cheap.", 4, { must: ['it is fast', 'it is cheap', 'it scales'] });
  assert.deepEqual(r.mustHit, ['it is fast', 'it is cheap']);
  assert.deepEqual(r.mustMiss, ['it scales']);
});

test('score: clean answer scores high, messy answer scores low, banned costs points', () => {
  const target = 'We are going to add more users next month';
  const good = analyze('We are going to add more users next month', 4, { target });
  const bad = analyze('so basically um we gonna add uh more users', 4, { target });
  assert.ok(good.score >= 90, `good ${good.score}`);
  assert.ok(bad.score < 60, `bad ${bad.score}`);
  const plain = analyze('the model is fast and cheap', 3, { banned: ['basically'] });
  const banned = analyze('the model is basically fast and cheap', 3, { banned: ['basically'] });
  assert.equal(banned.banned[0].count, 1);
  assert.ok(plain.score - banned.score >= 10);
  assert.equal(analyze('', 5).score, 0);
});

test('wpm and pace', () => {
  const r = analyze(Array(130).fill('word').join(' '), 60);
  assert.equal(r.wpm, 130);
  assert.equal(analyze('a b c', 0).wpm, 0);
});

test('tips are 1 to 3 neutral Hebrew lines that quote the transcript', () => {
  const r = analyze('so basically so we gonna add users so', 6);
  assert.ok(r.tips_he.length >= 1 && r.tips_he.length <= 3);
  assert.ok(r.tips_he[0].includes('we gonna'));
  assert.ok(r.tips_he.some((t) => t.includes('"so"')));
  assert.ok(r.tips_he.every((t) => !t.includes('אמרת')));
  assert.equal(r.tips_he[0], 'חסר is או are: "we gonna" -> "we are gonna".');
  assert.deepEqual(analyze('we ship it today', 5, { must: ['next step'] }).tips_he, ['חסר בתשובה: "next step".']);
  const many = analyze('Um, we ship it. Um, it works. Um, today.', 6).tips_he;
  assert.ok(many.some((t) => /^מילת מילוי "um" חזרה \d+ פעמים\. במקומה: עצירה קצרה ונשימה\.$/.test(t)), many.join(' | '));
  assert.equal(analyze('The model is ready for you.', 3).tips_he.length, 1);
});

test('highlight covers the whole text and marks kinds', () => {
  const src = 'So, I ask him and we gonna fix it, um, today.';
  const segs = highlight(src);
  assert.equal(segs.map((s) => s.text).join(''), src);
  const k = (kind) => segs.filter((s) => s.kind === kind).map((s) => s.text);
  assert.deepEqual(k('filler'), ['So', 'um']);
  assert.deepEqual(k('bedrop'), ['we gonna']);
  assert.deepEqual(highlight('').length, 0);
  const segs2 = highlight('the model said he is done');
  assert.deepEqual(segs2.filter((s) => s.kind === 'he').map((s) => s.text), ['he']);
});

test('no em dash or en dash in source', async () => {
  const { readFile } = await import('node:fs/promises');
  for (const f of ['../js/analyze.js', '../js/speech.js', './analyze.test.mjs']) {
    const src = await readFile(new URL(f, import.meta.url), 'utf8').catch(() => '');
    const bad = new RegExp("[" + String.fromCharCode(0x2013, 0x2014) + "]");
    assert.ok(!bad.test(src), f);
  }
});

test('target diff keeps original casing and punctuation in orig, w stays normalized', () => {
  const r = analyze('the model running on GPU', 3, { target: 'The model is running on the GPU.' });
  assert.deepEqual(r.diff.map((d) => d.w), ['the', 'model', 'is', 'running', 'on', 'the', 'gpu']);
  assert.deepEqual(r.diff.map((d) => d.orig), ['The', 'model', 'is', 'running', 'on', 'the', 'GPU.']);
  const r2 = analyze("We're gonna ship it", 3, { target: "We're going to ship it, OK?" });
  const okay = r2.diff.find((d) => d.w === 'okay');
  assert.equal(okay.orig, 'OK?');
  assert.deepEqual(r2.diff.filter((d) => d.w === 'are').map((d) => d.orig), ['']);
});
