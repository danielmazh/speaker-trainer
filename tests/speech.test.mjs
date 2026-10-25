// Node tests for js/speech.js with fake browser globals. No real mic, no network.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

let n = 0;
// Fresh module per test, so the on-device cache does not leak between tests.
const load = () => import(`../js/speech.js?case=${++n}`);
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

const KEYS = ['navigator', 'SpeechRecognition', 'webkitSpeechRecognition', 'MediaRecorder', 'document', 'AudioContext', 'addEventListener', 'removeEventListener'];
const saved = Object.fromEntries(KEYS.map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
function setG(k, v) { Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true }); }
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k]) Object.defineProperty(globalThis, k, saved[k]);
    else delete globalThis[k];
  }
});

function fakeStream() {
  const track = { stopped: 0, stop() { this.stopped++; } };
  return { track, getTracks: () => [track] };
}

// getUserMedia that never resolves on its own; the test can resolve it late.
// perm: 'granted' | 'prompt' | 'denied' | null (no Permissions API). ua: user agent string.
function permApi(perm) {
  if (!perm) return undefined;
  const status = { state: perm, onchange: null };
  return { status, query: async ({ name }) => { if (name !== 'microphone') throw new TypeError('bad'); return status; } };
}
function hangingMic({ perm = 'granted', ua = '' } = {}) {
  const m = { calls: 0, resolve: null };
  const permissions = permApi(perm);
  m.perm = permissions && permissions.status;
  setG('navigator', { userAgent: ua, permissions, mediaDevices: { getUserMedia() { m.calls++; return new Promise((r) => { m.resolve = r; }); } } });
  return m;
}
function workingMic({ perm = 'granted', ua = '', uad } = {}) {
  const m = { streams: [], calls: 0 };
  setG('navigator', { userAgent: ua, userAgentData: uad, permissions: permApi(perm), mediaDevices: { getUserMedia() { m.calls++; const s = fakeStream(); m.streams.push(s); return Promise.resolve(s); } } });
  return m;
}
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
const final = (t) => Object.assign([{ transcript: t }], { isFinal: true });
const inter = (t) => Object.assign([{ transcript: t }], { isFinal: false });

function fakeSR({ available } = {}) {
  const made = [];
  class SR {
    constructor() { this.started = 0; this.stopped = 0; this.aborted = 0; this.processLocally = false; made.push(this); }
    start() { this.started++; if (SR.autoStart) setTimeout(() => this.onstart && this.onstart(), 0); if (SR.endAtOnce) setTimeout(() => this.onend && this.onend(), 0); }
    stop() { this.stopped++; setTimeout(() => this.onend && this.onend(), 1); }
    abort() { this.aborted++; }
  }
  SR.availableCalls = 0;
  if (available) SR.available = (...a) => { SR.availableCalls++; return available(...a); };
  SR.made = made;
  setG('SpeechRecognition', SR);
  return SR;
}

// 1. getUserMedia timeout (only after permission is granted)

test('hanging getUserMedia after permission granted: start() resolves, onError mic-timeout, late stream is stopped', async () => {
  const mic = hangingMic();
  const SR = fakeSR();
  const { createSession } = await load();
  const errs = [];
  const s = createSession({ onError: (c) => errs.push(c), micTimeoutMs: 30, onDevice: 'off' });
  await s.start();
  assert.deepEqual(errs, ['mic-timeout'], 'a soft per-take code, not audio-capture');
  assert.equal(SR.made.length, 0, 'recognition not started after mic timeout');
  const late = fakeStream();
  mic.resolve(late);
  await tick(5);
  assert.equal(late.track.stopped, 1, 'late stream must be stopped at once');
  const res = await s.stop();
  assert.deepEqual(res, { transcript: '', durationSec: 0, audioUrl: null });
});

test('stop() while getUserMedia hangs: both resolve fast, no error, late stream stopped', async () => {
  const mic = hangingMic();
  fakeSR();
  const { createSession } = await load();
  const errs = [];
  const s = createSession({ onError: (c) => errs.push(c), micTimeoutMs: 10000, onDevice: 'off' });
  const started = s.start();
  await tick(1);
  const t = Date.now();
  const res = await s.stop();
  await started;
  assert.ok(Date.now() - t < 500);
  assert.equal(res.audioUrl, null);
  assert.deepEqual(errs, []);
  const late = fakeStream();
  mic.resolve(late);
  await tick(5);
  assert.equal(late.track.stopped, 1);
});

test('cancel() while getUserMedia hangs releases start()', async () => {
  hangingMic();
  fakeSR();
  const { createSession } = await load();
  const s = createSession({ micTimeoutMs: 10000, onDevice: 'off' });
  const started = s.start();
  await tick(1);
  s.cancel();
  await started;
  assert.deepEqual(await s.stop(), { transcript: '', durationSec: 0, audioUrl: null });
});

// 2. on-device probe

test('support() never probes; probeOnDevice() probes once and caches', async () => {
  const SR = fakeSR({ available: async () => 'available' });
  workingMic();
  const S = await load();
  const a = S.support();
  assert.equal(a.recognition, true);
  assert.equal(a.onDevice, 'unknown');
  await tick(5);
  assert.equal(SR.availableCalls, 0, 'support() must not call available()');
  assert.equal(await S.probeOnDevice('en-US'), 'yes');
  assert.equal(await S.probeOnDevice('en-US'), 'yes');
  assert.equal(SR.availableCalls, 1);
  assert.equal(S.support().onDevice, 'yes');
  assert.equal(S.cachedOnDevice('en-US'), 'yes');
});

test('probeOnDevice: sync throw and hang both give unknown', async () => {
  fakeSR({ available: () => { throw new Error('boom'); } });
  let S = await load();
  assert.equal(await S.probeOnDevice('en-US', { timeoutMs: 20 }), 'unknown');
  fakeSR({ available: () => new Promise(() => {}) });
  S = await load();
  const t = Date.now();
  assert.equal(await S.probeOnDevice('en-US', { timeoutMs: 20 }), 'unknown');
  assert.ok(Date.now() - t < 1000);
});

test('auto: no probe inside a take (no cached result) and the browser service is used', async () => {
  const SR = fakeSR({ available: () => new Promise(() => {}) });
  workingMic();
  const { createSession } = await load();
  const errs = [];
  const s = createSession({ onDevice: 'auto', record: false, onLevel: () => {}, probeTimeoutMs: 20, onError: (c) => errs.push(c) });
  await s.start();
  assert.equal(SR.availableCalls, 0, 'the first tap must not run the on-device probe in auto');
  assert.equal(SR.made.length, 1);
  assert.equal(SR.made[0].started, 1);
  assert.equal(SR.made[0].processLocally, false);
  assert.deepEqual(errs, []);
  await s.stop();
});

test('auto: cached yes is used without a new probe and runs locally', async () => {
  const SR = fakeSR({ available: async () => 'available' });
  workingMic();
  const S = await load();
  await S.probeOnDevice('en-US');
  const s = S.createSession({ onDevice: 'auto', record: false });
  await s.start();
  assert.equal(SR.availableCalls, 1);
  assert.equal(SR.made.at(-1).processLocally, true);
  await s.stop();
});

test("on: not 'yes' gives ondevice-unavailable and record only", async () => {
  const SR = fakeSR({ available: async () => 'unavailable' });
  const mic = workingMic();
  const { createSession } = await load();
  const errs = [];
  const s = createSession({ onDevice: 'on', record: true, onError: (c) => errs.push(c) });
  await s.start();
  assert.deepEqual(errs, ['ondevice-unavailable']);
  assert.equal(SR.made.filter((r) => r.started).length, 0, 'no recognition, so no cloud audio');
  await s.stop();
  assert.equal(mic.streams[0].track.stopped, 1, 'mic released on stop');
});

// 3. no sync throws, idempotent stop/cancel/discard

test('public functions never throw, even with hostile globals', async () => {
  Object.defineProperty(globalThis, 'SpeechRecognition', { get() { throw new Error('nope'); }, configurable: true });
  setG('navigator', { get mediaDevices() { throw new Error('nope'); } });
  const S = await load();
  assert.doesNotThrow(() => S.support());
  assert.doesNotThrow(() => S.cachedOnDevice());
  assert.equal(await S.probeOnDevice(), 'no');
  assert.equal(await S.installOnDevice(), false);
  let s;
  assert.doesNotThrow(() => { s = S.createSession(null); });
  await s.start();
  assert.doesNotThrow(() => { s.cancel(); s.discard(); });
  await s.stop();
});

test('stop, cancel, discard are idempotent in any order, even before start', async () => {
  workingMic();
  fakeSR();
  const { createSession } = await load();
  const orders = [
    ['stop', 'stop', 'cancel', 'cancel', 'discard', 'discard'],
    ['cancel', 'stop', 'discard', 'stop', 'cancel'],
    ['discard', 'cancel', 'stop'],
  ];
  for (const order of orders) {
    const s = createSession({ onDevice: 'off', record: false });
    for (const m of order) { const r = s[m](); if (r && r.then) await r; }
    await s.start(); // start after stop or cancel does nothing
  }
  for (const order of orders) {
    const s = createSession({ onDevice: 'off', record: false });
    const started = s.start();
    const outs = order.map((m) => s[m]());
    await started;
    await Promise.all(outs.filter((r) => r && r.then));
  }
});

test('stop() twice during recording returns the same result once', async () => {
  const mic = workingMic();
  const SR = fakeSR();
  const { createSession } = await load();
  const s = createSession({ onDevice: 'off', record: false, onLevel: () => {} });
  await s.start();
  const r = SR.made[0];
  r.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: 'hello world' }], { isFinal: true })] });
  const [a, b] = await Promise.all([s.stop(), s.stop()]);
  assert.equal(a.transcript, 'hello world');
  assert.deepEqual(a, b);
  assert.equal(r.stopped, 1);
  assert.equal(mic.streams[0].track.stopped, 1);
  s.cancel();
  s.cancel();
  assert.equal((await s.stop()).transcript, '');
});

// 4. visibility

test('page going hidden stops the take gracefully', async () => {
  const listeners = {};
  const doc = {
    hidden: false, visibilityState: 'visible',
    addEventListener(t, f) { listeners[t] = f; },
    removeEventListener(t, f) { if (listeners[t] === f) delete listeners[t]; },
  };
  setG('document', doc);
  const mic = workingMic();
  const SR = fakeSR();
  const { createSession } = await load();
  const s = createSession({ onDevice: 'off', record: false, onLevel: () => {} });
  await s.start();
  assert.equal(typeof listeners.visibilitychange, 'function');
  doc.hidden = true; doc.visibilityState = 'hidden';
  listeners.visibilitychange();
  await tick(5);
  assert.equal(SR.made[0].stopped, 1);
  assert.equal(mic.streams[0].track.stopped, 1);
  assert.equal(listeners.visibilitychange, undefined, 'listener removed after stop');
  const res = await s.stop();
  assert.equal(res.audioUrl, null);
});

// 5. recorder format

test('MediaRecorder mime is feature-detected (Safari: audio/mp4, else default)', async () => {
  workingMic();
  fakeSR();
  const made = [];
  class MR {
    constructor(stream, o) { this.opts = o; this.state = 'inactive'; made.push(this); }
    start() { this.state = 'recording'; }
    stop() { this.state = 'inactive'; setTimeout(() => this.onstop && this.onstop(), 1); }
  }
  MR.isTypeSupported = (t) => t === 'audio/mp4';
  setG('MediaRecorder', MR);
  let S = await load();
  let s = S.createSession({ onDevice: 'off' });
  await s.start();
  assert.deepEqual(made[0].opts, { mimeType: 'audio/mp4' });
  await s.stop();
  MR.isTypeSupported = () => false;
  S = await load();
  s = S.createSession({ onDevice: 'off' });
  await s.start();
  assert.equal(made[1].opts, undefined);
  await s.stop();
});

// 6. slow permission prompt: no timeout while the prompt is open

test('permission prompt: waits past the mic timeout, reports prompt then granted, then records', async () => {
  const mic = hangingMic({ perm: 'prompt' });
  const SR = fakeSR();
  const { createSession } = await load();
  const errs = [], perms = [];
  const s = createSession({ onDevice: 'off', exclusiveMic: false, micTimeoutMs: 20, onError: (c) => errs.push(c), onPermission: (p) => perms.push(p) });
  const started = s.start();
  await tick(80); // far past micTimeoutMs: the user is still reading the prompt
  assert.deepEqual(errs, []);
  assert.deepEqual(perms, ['prompt']);
  mic.resolve(fakeStream());
  await started;
  assert.deepEqual(perms, ['prompt', 'granted']);
  assert.equal(SR.made.length, 1, 'recognition starts after Allow');
  await s.stop();
});

test('permission prompt: the timeout starts only once permission changes to granted', async () => {
  const mic = hangingMic({ perm: 'prompt' });
  fakeSR();
  const { createSession } = await load();
  const errs = [];
  const s = createSession({ onDevice: 'off', exclusiveMic: false, micTimeoutMs: 20, onError: (c) => errs.push(c) });
  const started = s.start();
  await tick(50);
  assert.deepEqual(errs, []);
  mic.perm.state = 'granted';
  mic.perm.onchange();
  await started;
  assert.deepEqual(errs, ['mic-timeout']);
});

test('no Permissions API: the long prompt timeout applies, not the 6 s mic timeout', async () => {
  hangingMic({ perm: null });
  fakeSR();
  const { createSession } = await load();
  const errs = [];
  const s = createSession({ onDevice: 'off', exclusiveMic: false, micTimeoutMs: 10, promptTimeoutMs: 60, onError: (c) => errs.push(c) });
  const started = s.start();
  await tick(30);
  assert.deepEqual(errs, [], 'not yet: a prompt may be open');
  await started;
  assert.deepEqual(errs, ['mic-timeout']);
});

test('denied permission gives not-allowed and no recognition', async () => {
  setG('navigator', { userAgent: DESKTOP_UA, permissions: permApi('denied'), mediaDevices: { getUserMedia: async () => { const e = new Error('no'); e.name = 'NotAllowedError'; throw e; } } });
  const SR = fakeSR();
  const { createSession } = await load();
  const errs = [];
  const s = createSession({ onDevice: 'off', onError: (c) => errs.push(c) });
  await s.start();
  assert.deepEqual(errs, ['not-allowed']);
  assert.equal(SR.made.length, 0);
  await s.stop();
});

// 7. platform and mobile mic ownership

test('platform(): Android, iPhone, iPadOS, userAgentData.mobile, desktop', async () => {
  const S = await load();
  setG('navigator', { userAgent: ANDROID_UA });
  assert.deepEqual(S.platform(), { mobile: true, ios: false, android: true, brave: false });
  setG('navigator', { userAgent: IPHONE_UA });
  assert.deepEqual(S.platform(), { mobile: true, ios: true, android: false, brave: false });
  setG('navigator', { userAgent: DESKTOP_UA.replace('Chrome/129.0 ', ''), maxTouchPoints: 5 });
  assert.equal(S.platform().ios, true, 'iPadOS reports a Mac UA');
  setG('navigator', { userAgent: 'x', userAgentData: { mobile: true } });
  assert.equal(S.platform().mobile, true);
  setG('navigator', { userAgent: DESKTOP_UA, userAgentData: { mobile: false } });
  assert.deepEqual(S.platform(), { mobile: false, ios: false, android: false, brave: false });
});

test('Android: recognition take never opens getUserMedia, no recorder, no level meter', async () => {
  const mic = workingMic({ ua: ANDROID_UA });
  const SR = fakeSR();
  const recs = [];
  setG('MediaRecorder', class { constructor() { recs.push(this); } start() {} stop() {} });
  const { createSession } = await load();
  let levels = 0;
  const acts = [];
  const s = createSession({ onDevice: 'off', record: true, onLevel: () => levels++, onActivity: (k) => acts.push(k) });
  await s.start();
  assert.equal(mic.calls, 0, 'recognition alone owns the mic');
  assert.equal(recs.length, 0);
  assert.equal(SR.made.length, 1);
  const r = SR.made[0];
  r.onstart(); r.onsoundstart(); r.onspeechstart();
  r.onresult({ resultIndex: 0, results: [final('hello')] });
  assert.deepEqual(acts, ['start', 'sound', 'speech', 'result']);
  const res = await s.stop();
  assert.equal(res.transcript, 'hello');
  assert.equal(res.audioUrl, null);
  assert.equal(levels, 0);
});

test('iPhone: recognition take is exclusive and non-continuous', async () => {
  const mic = workingMic({ ua: IPHONE_UA });
  const SR = fakeSR();
  const { createSession } = await load();
  const s = createSession({ onDevice: 'off' });
  await s.start();
  assert.equal(mic.calls, 0);
  assert.equal(SR.made[0].continuous, false);
  await s.stop();
});

test('mobile record-only take (recognize:false) opens the mic and records, no recognition', async () => {
  const mic = workingMic({ ua: ANDROID_UA });
  const SR = fakeSR();
  const recs = [];
  setG('MediaRecorder', class { constructor() { this.state = 'inactive'; recs.push(this); } start() { this.state = 'recording'; } stop() { this.state = 'inactive'; setTimeout(() => this.onstop && this.onstop(), 1); } });
  const { createSession } = await load();
  const errs = [];
  let ready = 0;
  const s = createSession({ onDevice: 'off', recognize: false, onReady: () => ready++, onError: (c) => errs.push(c) });
  await s.start();
  assert.equal(mic.calls, 1);
  assert.equal(recs.length, 1);
  assert.equal(SR.made.length, 0);
  assert.equal(ready, 1, 'ready when the recorder starts');
  assert.deepEqual(errs, []);
  await s.stop();
  assert.equal(mic.streams[0].track.stopped, 1);
});

test('desktop: record and recognition run together; a given AudioContext is used and closed', async () => {
  const mic = workingMic({ ua: DESKTOP_UA });
  const SR = fakeSR();
  const recs = [];
  setG('MediaRecorder', class { constructor() { this.state = 'inactive'; recs.push(this); } start() { this.state = 'recording'; } stop() { this.state = 'inactive'; setTimeout(() => this.onstop && this.onstop(), 1); } });
  const ac = { state: 'running', closed: 0, createMediaStreamSource: () => ({ connect() {} }), createAnalyser: () => ({ fftSize: 0, getByteTimeDomainData() {} }), close() { this.closed++; return Promise.resolve(); } };
  setG('AudioContext', class { constructor() { throw new Error('must use the given one'); } });
  const { createSession } = await load();
  const s = createSession({ onDevice: 'off', audioCtx: ac, onLevel: () => {} });
  await s.start();
  assert.equal(mic.calls, 1);
  assert.equal(recs.length, 1);
  assert.equal(SR.made.length, 1);
  await s.stop();
  assert.equal(ac.closed, 1);
});

// 8. listening starts at recognition onstart

test('onReady fires at recognition onstart, not at start()', async () => {
  workingMic({ ua: ANDROID_UA });
  const SR = fakeSR();
  const { createSession } = await load();
  let ready = 0;
  const s = createSession({ onDevice: 'off', onReady: () => ready++ });
  await s.start();
  assert.equal(ready, 0, 'not listening yet');
  SR.made[0].onstart();
  assert.equal(ready, 1);
  SR.made[0].onstart();
  assert.equal(ready, 1, 'once per take');
  await s.stop();
});

// 9. recognition gives up with a clear code

test('recognizer that ends at once: 3 runs, then rec-failed (no silent fallback, no 9 beeps)', async () => {
  workingMic({ ua: ANDROID_UA });
  const SR = fakeSR();
  SR.endAtOnce = true;
  const { createSession } = await load();
  const errs = [];
  const s = createSession({ onDevice: 'off', onError: (c) => errs.push(c) });
  await s.start();
  await tick(1200);
  assert.equal(SR.made.length, 3);
  assert.deepEqual(errs, ['rec-failed']);
  await s.stop();
});

test('runs with results restart without counting as failures', async () => {
  workingMic({ ua: ANDROID_UA });
  const SR = fakeSR();
  const { createSession } = await load();
  const errs = [];
  const s = createSession({ onDevice: 'off', onError: (c) => errs.push(c) });
  await s.start();
  for (let k = 0; k < 5; k++) {
    const r = SR.made.at(-1);
    r.onresult({ resultIndex: 0, results: [final(`word${k} more`)] });
    r.onend();
    await tick(80);
  }
  assert.equal(SR.made.length, 6);
  assert.deepEqual(errs, []);
  const res = await s.stop();
  assert.equal(res.transcript, 'word0 more word1 more word2 more word3 more word4 more');
});

test('iOS service-not-allowed means Dictation is off', async () => {
  workingMic({ ua: IPHONE_UA });
  const SR = fakeSR();
  const { createSession } = await load();
  const errs = [];
  const s = createSession({ onDevice: 'off', onError: (c) => errs.push(c) });
  await s.start();
  SR.made[0].onerror({ error: 'service-not-allowed' });
  assert.deepEqual(errs, ['dictation-off']);
  await s.stop();
});

// 10. merge

test('joinSegments compares whole words', async () => {
  const { joinSegments } = await load();
  assert.equal(joinSegments(['I', 'It works']), 'I It works');
  assert.equal(joinSegments(['deploy now', 'now']), 'deploy now now');
  assert.equal(joinSegments(['unknown', 'own']), 'unknown own');
  assert.equal(joinSegments(['we are', 'we are going']), 'we are going');
  assert.equal(joinSegments(['we are going to', 'going to']), 'we are going to', 'a 2-word repeat is dropped');
  assert.equal(joinSegments(['We are.', 'we are going']), 'we are going');
});

test('end-of-run interim words are kept when Android ends a run itself', async () => {
  workingMic({ ua: ANDROID_UA });
  const SR = fakeSR();
  const { createSession } = await load();
  const s = createSession({ onDevice: 'off' });
  await s.start();
  const r = SR.made[0];
  r.onresult({ resultIndex: 0, results: [final('the cache'), inter('is warm now')] });
  r.onend(); // no final for the interim words
  await tick(80);
  assert.equal(SR.made.length, 2, 'restarted');
  const res = await s.stop();
  assert.equal(res.transcript, 'the cache is warm now');
});

test("onDevice 'on' with no cached result probes inside the take (explicit setting)", async () => {
  const SR = fakeSR({ available: async () => 'available' });
  workingMic({ ua: DESKTOP_UA });
  const { createSession } = await load();
  const s = createSession({ onDevice: 'on', record: false });
  await s.start();
  assert.equal(SR.availableCalls, 1);
  assert.equal(SR.made.at(-1).processLocally, true);
  await s.stop();
});

// 11. mic.js error policy: one error must not poison the session

test('mic errorPolicy: only not-allowed is sticky; mobile takes end on any recognition error', async () => {
  const { errorPolicy, noticeMode } = await import('../js/ui/mic.js');
  assert.equal(errorPolicy('not-allowed').sticky, true);
  for (const c of ['network', 'no-speech', 'audio-capture', 'aborted', 'rec-failed', 'mic-timeout', 'dictation-off']) {
    assert.equal(errorPolicy(c).sticky, false, `${c} is per take`);
  }
  assert.equal(errorPolicy('network', 'both').endsTake, false, 'desktop keeps recording');
  assert.equal(errorPolicy('network', 'rec-only').endsTake, true, 'mobile: nothing left in the take');
  assert.equal(errorPolicy('rec-failed', 'rec-only').endsTake, true);
  assert.equal(errorPolicy('mic-timeout', 'both').endsTake, true);
  assert.equal(errorPolicy('no-speech', 'rec-only').show, false);
  assert.ok(/[֐-׿]/.test(errorPolicy('rec-failed').message), 'Hebrew message for give-up');
  assert.ok(/[֐-׿]/.test(errorPolicy('dictation-off').message));
  const session = {};
  assert.equal(noticeMode(session, 'unsupported'), 'full');
  assert.equal(noticeMode(session, 'unsupported'), 'chip');
  assert.equal(noticeMode(session, 'not-allowed'), 'full');
  assert.equal(noticeMode(session, null), null);
});

// 12. iOS: no restart outside a user tap; a refused restart is never a denied permission

test('iOS: recognizer ending on its own is not restarted; words are kept and onEnded fires', async () => {
  workingMic({ ua: IPHONE_UA });
  const SR = fakeSR();
  const { createSession } = await load();
  const errs = [];
  let ended = 0;
  const s = createSession({ onDevice: 'off', onError: (c) => errs.push(c), onEnded: () => ended++ });
  await s.start();
  const r = SR.made[0];
  r.onstart();
  r.onresult({ resultIndex: 0, results: [final('the cache is warm')] });
  r.onend();
  await tick(500);
  assert.equal(SR.made.length, 1, 'no restart from a timer');
  assert.equal(ended, 1);
  assert.deepEqual(errs, []);
  const res = await s.stop();
  assert.equal(res.transcript, 'the cache is warm');
});

test('iOS: recognizer ending before it ever started gives rec-failed, not not-allowed', async () => {
  workingMic({ ua: IPHONE_UA });
  const SR = fakeSR();
  SR.endAtOnce = true;
  const { createSession } = await load();
  const errs = [];
  let ended = 0;
  const s = createSession({ onDevice: 'off', onError: (c) => errs.push(c), onEnded: () => ended++ });
  await s.start();
  await tick(500);
  assert.equal(SR.made.length, 1);
  assert.deepEqual(errs, ['rec-failed']);
  assert.equal(ended, 0);
  await s.stop();
});

test('Android: a restarted run refused with not-allowed reports rec-failed', async () => {
  workingMic({ ua: ANDROID_UA });
  const SR = fakeSR();
  const { createSession } = await load();
  const errs = [];
  const s = createSession({ onDevice: 'off', onError: (c) => errs.push(c) });
  await s.start();
  SR.made[0].onstart();
  SR.made[0].onresult({ resultIndex: 0, results: [final('first part')] });
  SR.made[0].onend();
  await tick(80);
  assert.equal(SR.made.length, 2, 'Android still restarts');
  SR.made[1].onerror({ error: 'not-allowed' });
  assert.deepEqual(errs, ['rec-failed']);
  const res = await s.stop();
  assert.equal(res.transcript, 'first part');
});

test('first run not-allowed is still reported as not-allowed', async () => {
  workingMic({ ua: ANDROID_UA });
  const SR = fakeSR();
  const { createSession } = await load();
  const errs = [];
  const s = createSession({ onDevice: 'off', onError: (c) => errs.push(c) });
  await s.start();
  SR.made[0].onerror({ error: 'not-allowed' });
  assert.deepEqual(errs, ['not-allowed']);
  await s.stop();
});

// 13. exclusive take stuck in "starting"

test('exclusive take with no onstart: mic-timeout after the start timeout, recognition aborted', async () => {
  workingMic({ ua: ANDROID_UA });
  const SR = fakeSR();
  const { createSession } = await load();
  const errs = [];
  let ready = 0;
  const s = createSession({ onDevice: 'off', startTimeoutMs: 60, onError: (c) => errs.push(c), onReady: () => ready++ });
  await s.start();
  await tick(600);
  assert.deepEqual(errs, ['mic-timeout']);
  assert.equal(SR.made[0].aborted, 1);
  assert.equal(ready, 0);
  const t = Date.now();
  const res = await s.stop();
  assert.ok(Date.now() - t < 200, 'stop resolves at once');
  assert.equal(res.transcript, '');
  SR.made[0].onstart && SR.made[0].onstart();
  assert.equal(ready, 0, 'a late onstart is ignored');
});

test('exclusive take: onstart in time means no timeout', async () => {
  workingMic({ ua: ANDROID_UA });
  const SR = fakeSR();
  SR.autoStart = true;
  const { createSession } = await load();
  const errs = [];
  const s = createSession({ onDevice: 'off', startTimeoutMs: 60, onError: (c) => errs.push(c) });
  await s.start();
  await tick(600);
  assert.deepEqual(errs, []);
  await s.stop();
});

test('exclusive take: the start timeout waits while a permission prompt is open', async () => {
  const perm = permApi('prompt');
  setG('navigator', { userAgent: ANDROID_UA, permissions: perm, mediaDevices: { getUserMedia: () => Promise.reject(new Error('no')) } });
  fakeSR();
  const { createSession } = await load();
  const errs = [];
  const perms = [];
  const s = createSession({ onDevice: 'off', startTimeoutMs: 60, onError: (c) => errs.push(c), onPermission: (p) => perms.push(p) });
  await s.start();
  await tick(600);
  assert.deepEqual(errs, [], 'no timeout while the prompt is open');
  assert.deepEqual(perms, ['prompt']);
  perm.status.state = 'granted';
  perm.status.onchange();
  await tick(300);
  assert.deepEqual(errs, ['mic-timeout']);
  assert.deepEqual(perms, ['prompt', 'granted']);
  await s.stop();
});

// 14. page listeners never pile up across takes

test('visibility and pagehide listeners are removed after every take, on every path', async () => {
  const live = new Map();
  const add = (t, f) => { const k = `${t}`; live.set(k, (live.get(k) || 0) + 1); void f; };
  const rem = (t) => { const k = `${t}`; live.set(k, (live.get(k) || 0) - 1); };
  setG('document', { hidden: false, visibilityState: 'visible', addEventListener: add, removeEventListener: rem });
  setG('addEventListener', add);
  setG('removeEventListener', rem);
  const total = () => [...live.values()].reduce((a, b) => a + b, 0);
  workingMic({ ua: ANDROID_UA });
  const SR = fakeSR();
  const { createSession } = await load();
  for (let k = 0; k < 4; k++) {
    // normal take
    let s = createSession({ onDevice: 'off' });
    await s.start();
    SR.made.at(-1).onstart();
    await s.stop();
    // start timeout
    s = createSession({ onDevice: 'off', startTimeoutMs: 20 });
    await s.start();
    await tick(450);
    await s.stop();
    // cancel while starting
    s = createSession({ onDevice: 'off' });
    const p = s.start();
    s.cancel();
    await p;
    // error that ends recognition, then stop
    s = createSession({ onDevice: 'off' });
    await s.start();
    SR.made.at(-1).onerror({ error: 'network' });
    await s.stop();
  }
  assert.equal(total(), 0, 'every add has a remove');
});

test('Brave: detected, its note is sticky and quiet, never blames the user', async () => {
  const { errorPolicy } = await import('../js/ui/mic.js');
  const p = errorPolicy('brave', 'rec-only');
  assert.equal(p.sticky, true, 'brave stays for the session');
  assert.equal(p.endsTake, false, 'record-only take keeps going');
  assert.match(p.message, /Chrome/);
  const od = errorPolicy('ondevice-unavailable');
  assert.doesNotMatch(od.message, /בחרת/, 'no "you chose" wording');
  assert.equal(errorPolicy('local-failed').sticky, false);
  const prev = globalThis.navigator;
  Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile', brave: {} }, configurable: true });
  try {
    const { platform } = await import(`../js/speech.js?brave=${Date.now()}`);
    assert.equal(platform().brave, true);
    assert.equal(platform().android, true);
  } finally {
    Object.defineProperty(globalThis, 'navigator', { value: prev, configurable: true });
  }
});
