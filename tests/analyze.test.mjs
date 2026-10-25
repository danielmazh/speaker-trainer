import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, analyze, highlight, fixWordSets } from '../js/analyze.js';

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

// ---------------------------------------------------------------------------
// New options and fixes (2026-10-25 scoring audit)

test('avoid: reading the wrong sentence unchanged is capped at 30 with a Hebrew tip', () => {
  const wrong = 'fixing stuff that not working so well';
  const right = 'fixing things that are not working well';
  const bad = analyze(wrong, 4, { target: right, avoid: wrong });
  assert.equal(bad.saidAvoid, true);
  assert.ok(bad.score <= 30, `wrong read ${bad.score}`);
  assert.equal(bad.tips_he[0], 'זה המשפט עם הטעות. נסה את הגרסה המתוקנת.');
  const good = analyze(right, 4, { target: right, avoid: wrong });
  assert.equal(good.saidAvoid, false);
  assert.ok(good.score >= 90, `right read ${good.score}`);
  assert.ok(good.avoidScore < good.targetScore);
  // A one-word correction still separates the two readings.
  const w2 = "I'm agree with you.", r2 = 'I agree with you.';
  assert.ok(analyze(w2, 2, { target: r2, avoid: w2 }).score <= 30);
  assert.ok(analyze(r2, 2, { target: r2, avoid: w2 }).score >= 90);
  // No avoid option: old fields stay, new ones are null/false.
  const plain = analyze(right, 4, { target: right });
  assert.equal(plain.avoidScore, null);
  assert.equal(plain.saidAvoid, false);
});

test('reference: key-word coverage of a model answer', () => {
  const model = 'Because the alert was on errors, not on traffic. The traffic dropped, but nothing errored. We added a traffic alert, and we would now detect it in about 5 minutes.';
  const self = analyze(model, 12, { reference: model, minWords: 12 });
  assert.equal(self.referenceScore, 1);
  assert.ok(self.keyHit.length >= 5 && self.keyHit.length <= 8, self.keyHit.join(','));
  assert.ok(self.score >= 85, `self ${self.score}`);
  const para = analyze('We only alerted on errors, and traffic dropped without errors. Now we have a traffic alert and we would detect it in five minutes.', 10, { reference: model, minWords: 12 });
  assert.ok(para.score >= 80, `paraphrase ${para.score}`);
  const off = analyze('The team worked very hard on this and we are proud of the results we got this year.', 8, { reference: model, minWords: 12 });
  assert.ok(off.referenceScore < 0.3);
  assert.ok(off.score < 60, `off-topic ${off.score}`);
  assert.ok(off.tips_he.some((t) => t.startsWith('אפשר להוסיף גם:')));
});

test('minWords: short answers are scaled down, "yes" scores low', () => {
  const yes = analyze('yes', 1, { minWords: 12 });
  assert.ok(yes.score <= 15, `yes ${yes.score}`);
  assert.equal(yes.lengthFactor, Math.round((1 / 12) * 1000) / 1000);
  assert.ok(yes.tips_he.includes('התשובה קצרה מדי. הוסף עוד משפט או שניים.'));
  assert.ok(analyze("I don't know", 2, { minWords: 12 }).score < 40);
  const long = analyze('We moved the cache to its own cluster, and now the API answers in half the time it used to.', 6, { minWords: 12 });
  assert.equal(long.lengthFactor, 1);
  // Without minWords the old behavior stays.
  assert.equal(analyze('yes', 1).lengthFactor, null);
});

test('must-only gaming: saying only the must phrases does not score 100', () => {
  const must = ['traffic', 'servers'];
  const gamed = analyze('traffic servers', 3, { must, minWords: 15 });
  assert.equal(gamed.mustHit.length, 2);
  assert.ok(gamed.score < 20, `must only ${gamed.score}`);
  const real = analyze('We split the traffic across three servers, so one slow node does not hurt the users any more.', 7, { must, minWords: 15 });
  assert.ok(real.score >= 90, `real ${real.score}`);
});

test('p.m. and a.m. are not the filler "um" and match PM/AM', () => {
  const r = analyze("We'll deploy it by 3 p.m. on Friday.", 4, { target: "We'll deploy it by 3 PM on Friday." });
  assert.equal(r.fillerTotal, 0);
  assert.equal(r.targetScore, 1);
  assert.equal(r.score, 100);
  assert.equal(analyze('the job runs at 9 a.m. every day', 4).fillerTotal, 0);
  assert.equal(tokenize('by 3 p.m. Then')[2].norm, 'pm');
  assert.equal(tokenize('by 3 p.m. Then')[3].boundary, true);
  assert.equal(analyze('um we start at ten', 3).fillers.um, 1);
  assert.equal(analyze('hmm we start at ten', 3).fillers.um, 1);
});

test('numbers said as words match digits and the other way', () => {
  const pairs = [
    ['We have twenty-one services', 'We have 21 services.'],
    ['We have 21 services', 'We have twenty-one services.'],
    ['It costs three thousand dollars', 'It costs $3,000.'],
    ['It costs 3000 dollars', 'It costs $3,000.'],
    ['It costs $3,000', 'It costs three thousand dollars.'],
    ['about forty percent of users', 'about 40% of users'],
    ['about 40% of users', 'about forty percent of users'],
    ['three point five seconds', '3.5 seconds'],
    ['fifteen hundred dollars a month', '1,500 dollars a month'],
    ['a thousand users', '1,000 users'],
    ['between March third and March seventh', 'between March 3rd and March 7th'],
    ['in twenty twenty-six', 'in 2026'],
    ['two million requests', '2 million requests'],
  ];
  for (const [spoken, target] of pairs) {
    assert.equal(analyze(spoken, 3, { target }).targetScore, 1, `${spoken} vs ${target}`);
  }
  // Separate numbers stay separate.
  assert.equal(analyze('two or three servers', 3, { target: '2 or 3 servers' }).targetScore, 1);
  assert.ok(analyze('five servers', 3, { target: '50 servers' }).targetScore < 1);
});

test('like and actually: real uses are not fillers', () => {
  for (const line of [
    'users like it',
    'tools like Git and Grafana help a lot',
    'what actually happened was a config change',
    'Then people use the old flow, like they do today.',
    "What's the weather like where you are?",
    'Could you say that again?',
    'We are almost out of time, so let us wrap up.',
    'It read ten thousand rows.',
  ]) {
    const r = analyze(line, 5);
    assert.equal(r.fillerTotal, 0, `fillers in: ${line} -> ${JSON.stringify(r.fillers)}`);
    assert.equal(r.beDrops.length, 0, `beDrops in: ${line}`);
  }
  assert.equal(analyze('Actually, the cache is fine', 4).fillers.actually, 1);
  assert.equal(analyze('and actually we shipped it', 4).fillers.actually, 1);
  assert.equal(analyze('we need like two more days', 4).fillers.like, 1);
  assert.equal(analyze('So, we start now', 4).fillers.so, 1);
});

test('content: model answers score high, wrong sentences stay low, no spoken placeholders', async () => {
  const { ITEMS } = await import('../js/content.js');
  const dur = (t) => Math.max(1, (t.split(/\s+/).length / 130) * 60);
  for (const it of ITEMS) {
    if (it.type === 'speak') {
      const r = analyze(it.model_en, dur(it.model_en), { must: it.must, banned: it.banned, minWords: 15 });
      assert.ok(r.score >= 90, `${it.id} speak model ${r.score}`);
    } else if (it.type === 'qa') {
      const r = analyze(it.model_en, dur(it.model_en), { reference: it.model_en, minWords: 12 });
      assert.ok(r.score >= 85, `${it.id} qa model ${r.score}`);
    } else if (it.type === 'fix') {
      const ok = analyze(it.right, dur(it.right), { target: it.right, avoid: it.wrong });
      const bad = analyze(it.wrong, dur(it.wrong), { target: it.right, avoid: it.wrong });
      assert.ok(ok.score >= 90, `${it.id} fix right ${ok.score}`);
      assert.ok(bad.score <= 30, `${it.id} fix wrong ${bad.score}`);
    }
    for (const f of ['right', 'model_en', 'text_en', 'sentence_en']) {
      if (typeof it[f] === 'string') assert.ok(!/\[[A-Za-z]+\]/.test(it[f]), `${it.id}.${f} has a placeholder`);
    }
  }
});

test('content: choice answers are balanced and the quote is never an option', async () => {
  const { ITEMS } = await import('../js/content.js');
  const ch = ITEMS.filter((i) => i.type === 'choice');
  const dist = [0, 0, 0];
  for (const i of ch) {
    dist[i.correct]++;
    const n = (s) => String(s).trim().toLowerCase();
    assert.ok(!i.options.some((o) => n(o) === n(i.wrong)), `${i.id} quote equals an option`);
  }
  for (const c of dist) assert.ok(Math.abs(c - ch.length / 3) <= 2, `distribution ${dist}`);
});

test('fix drill: with the play-fix must/banned lists, the right sentence scores >= 95 and the wrong one <= 30 (all items)', async () => {
  const { ITEMS } = await import('../js/content.js');
  const dur = (t) => Math.max(1, (t.split(/\s+/).length / 130) * 60);
  const fixes = ITEMS.filter((i) => i.type === 'fix');
  assert.ok(fixes.length > 100);
  for (const it of fixes) {
    const { must, banned } = fixWordSets(it.right, it.wrong);
    const opts = { target: it.right, avoid: it.wrong, must, banned };
    const ok = analyze(it.right, dur(it.right), opts);
    const bad = analyze(it.wrong, dur(it.wrong), opts);
    assert.ok(ok.score >= 95, `${it.id} right "${it.right}" ${ok.score}`);
    assert.ok(bad.score <= 30, `${it.id} wrong "${it.wrong}" ${bad.score}`);
  }
  // The reported cases: contractions and number words.
  const st7 = fixWordSets("We're on track.", 'We are on the track.');
  assert.ok(!st7.banned.includes('we') && !st7.banned.includes('are'));
  assert.equal(analyze("We're on track.", 2, { target: "We're on track.", avoid: 'We are on the track.', ...st7 }).score, 100);
});

test('fillers that are part of the target text cost nothing; short answers are not rate-punished', () => {
  const target = 'He said it was "basically done" and kind of ready.';
  const r = analyze(target, 4, { target });
  assert.equal(r.fillerTotal, 0);
  assert.equal(r.score, 100);
  // A filler added on top of the target still counts.
  assert.equal(analyze('so ' + target, 4, { target }).fillers.so, 1);
  // One "so" in a 4-word answer: fluency is not 0.
  assert.ok(analyze('so we fixed it', 2).score >= 85);
});
