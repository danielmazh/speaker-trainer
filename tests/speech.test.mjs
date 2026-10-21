// Node tests for js/speech.js with fake browser globals. No real mic, no network.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

let n = 0;
// Fresh module per test, so the on-device cache does not leak between tests.
const load = () => import(`../js/speech.js?case=${++n}`);
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

const KEYS = ['navigator', 'SpeechRecognition', 'webkitSpeechRecognition', 'MediaRecorder', 'document', 'AudioContext'];
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
function hangingMic() {
  const m = { calls: 0, resolve: null };
  setG('navigator', { mediaDevices: { getUserMedia() { m.calls++; return new Promise((r) => { m.resolve = r; }); } } });
  return m;
}
function workingMic() {
  const m = { streams: [] };
  setG('navigator', { mediaDevices: { getUserMedia() { const s = fakeStream(); m.streams.push(s); return Promise.resolve(s); } } });
  return m;
}

function fakeSR({ available } = {}) {
  const made = [];
  class SR {
    constructor() { this.started = 0; this.stopped = 0; this.aborted = 0; this.processLocally = false; made.push(this); }
    start() { this.started++; }
    stop() { this.stopped++; setTimeout(() => this.onend && this.onend(), 1); }
    abort() { this.aborted++; }
  }
  SR.availableCalls = 0;
  if (available) SR.available = (...a) => { SR.availableCalls++; return available(...a); };
  SR.made = made;
  setG('SpeechRecognition', SR);
  return SR;
}

// 1. getUserMedia timeout

test('hanging getUserMedia: start() resolves, onError audio-capture, late stream is stopped', async () => {
  const mic = hangingMic();
  const SR = fakeSR();
  const { createSession } = await load();
  const errs = [];
  const s = createSession({ onError: (c) => errs.push(c), micTimeoutMs: 30, onDevice: 'off' });
  await s.start();
  assert.deepEqual(errs, ['audio-capture']);
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

test('auto: unknown probe falls back to the browser service', async () => {
  const SR = fakeSR({ available: () => new Promise(() => {}) });
  workingMic();
  const { createSession } = await load();
  const errs = [];
  const s = createSession({ onDevice: 'auto', record: false, onLevel: () => {}, probeTimeoutMs: 20, onError: (c) => errs.push(c) });
  await s.start();
  assert.equal(SR.availableCalls, 1);
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
