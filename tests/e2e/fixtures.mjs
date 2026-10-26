// Shared e2e fixtures: fake mic and speech recognition, error capture, network guard, helpers.
import { test as base, expect } from '@playwright/test';

export const SCRIPT = 'so basically we gonna add users and um the model is fast';
export const STORE_KEY = 'speakerTrainer.v1';

// Runs in the page before any app code. mode 'mic': fake SpeechRecognition + fake getUserMedia.
// mode 'nomic': no SpeechRecognition, getUserMedia denied.
// Recognizer switches on window.__fake: endOnFinish (ends by itself after the last word, like iOS after a
// pause), noStart (start() never fires 'start': a take stuck in "starting").
function initFakes(mode) {
  const w = window;
  w.__fake = { text: 'so basically we gonna add users and um the model is fast', stepMs: 35, sessions: 0 };
  w.__vibes = [];
  w.__audioCtx = 0;
  w.__gesture = false;
  w.__audioBeforeGesture = 0;
  const mark = () => { w.__gesture = true; };
  ['pointerdown', 'keydown', 'click', 'touchstart'].forEach((t) => w.addEventListener(t, mark, true));

  // Live page listeners by type (visibilitychange, pagehide), so tests can check they never pile up.
  w.__listeners = { visibilitychange: 0, pagehide: 0 };
  const watchListeners = (target) => {
    const live = new Map(Object.keys(w.__listeners).map((t) => [t, new Set()]));
    const add = target.addEventListener, rem = target.removeEventListener;
    target.addEventListener = function (t, f, o) {
      if (live.has(t) && f && !live.get(t).has(f)) { live.get(t).add(f); w.__listeners[t]++; }
      return add.call(this, t, f, o);
    };
    target.removeEventListener = function (t, f, o) {
      if (live.has(t) && live.get(t).delete(f)) w.__listeners[t]--;
      return rem.call(this, t, f, o);
    };
  };
  watchListeners(w);
  watchListeners(document);

  // Haptics recorder.
  try {
    Object.defineProperty(Navigator.prototype, 'vibrate', {
      configurable: true,
      value(p) { w.__vibes.push(p); return true; },
    });
  } catch { /* ignore */ }

  // Count AudioContexts and note any created before a user gesture.
  const AC = w.AudioContext;
  if (AC) {
    w.AudioContext = class extends AC {
      constructor(...a) { super(...a); w.__audioCtx++; if (!w.__gesture) w.__audioBeforeGesture++; }
    };
    w.webkitAudioContext = w.AudioContext;
  }

  // Speech synthesis: quiet and instant, so "listen" buttons work headless.
  try {
    if (w.speechSynthesis) {
      w.speechSynthesis.speak = (u) => { setTimeout(() => { try { u.onend && u.onend(); } catch { /* ignore */ } }, 20); };
    }
  } catch { /* ignore */ }

  if (mode === 'nomic') {
    try { delete w.SpeechRecognition; } catch { /* ignore */ }
    try { delete w.webkitSpeechRecognition; } catch { /* ignore */ }
    Object.defineProperty(w, 'SpeechRecognition', { value: undefined, configurable: true });
    Object.defineProperty(w, 'webkitSpeechRecognition', { value: undefined, configurable: true });
    if (navigator.mediaDevices) {
      navigator.mediaDevices.getUserMedia = async () => { const e = new Error('Permission denied'); e.name = 'NotAllowedError'; throw e; };
    }
    return;
  }

  // Result list shaped like the real SpeechRecognitionResultList.
  const resultList = (arr) => {
    const list = arr.map(({ text, final }) => {
      const alt = { transcript: text, confidence: 0.9 };
      const r = { 0: alt, length: 1, isFinal: final, item: (i) => (i === 0 ? alt : null) };
      return r;
    });
    const out = { length: list.length, item: (i) => list[i] };
    list.forEach((r, i) => { out[i] = r; });
    return out;
  };

  class FakeSR extends EventTarget {
    constructor() {
      super();
      this.lang = 'en-US'; this.continuous = false; this.interimResults = false; this.maxAlternatives = 1;
      this.onresult = null; this.onend = null; this.onerror = null; this.onstart = null;
      this._timers = []; this._running = false; this._finals = []; this._interim = '';
    }
    _emit(type, ev) {
      const e = Object.assign(new Event(type), ev || {});
      const h = this[`on${type}`];
      try { h && h.call(this, e); } catch (err) { setTimeout(() => { throw err; }); }
      this.dispatchEvent(e);
    }
    _results() {
      const arr = this._finals.map((t) => ({ text: t, final: true }));
      if (this._interim) arr.push({ text: this._interim, final: false });
      return arr;
    }
    start() {
      if (this._running) { const e = new Error('already started'); e.name = 'InvalidStateError'; throw e; }
      this._running = true;
      w.__fake.sessions++;
      w.__fake.finished = false;
      const words = String(w.__fake.text || '').split(/\s+/).filter(Boolean);
      const half = Math.max(1, Math.floor(words.length / 2));
      let i = 0;
      this._words = words;
      if (!w.__fake.noStart) this._emit('start');
      else return;
      const step = () => {
        if (!this._running) return;
        i++;
        if (i === half) {
          // First half becomes a final result, the rest stays interim.
          this._finals.push(words.slice(0, half).join(' '));
          this._interim = '';
          this._emit('result', { resultIndex: 0, results: resultList(this._results()) });
        } else {
          this._interim = words.slice(i > half ? half : 0, i).join(' ');
          this._emit('result', { resultIndex: this._finals.length ? this._finals.length : 0, results: resultList(this._results()) });
        }
        this._done = i >= words.length;
        if (this._done) w.__fake.finished = true;
        if (this._done && w.__fake.endOnFinish) {
          // The recognizer ends on its own: the rest becomes final, then 'end' (no stop() call).
          this._timers.push(setTimeout(() => {
            if (!this._running) return;
            this._running = false;
            const said = this._finals.join(' ').split(/\s+/).filter(Boolean).length;
            const rest = words.slice(said).join(' ');
            if (rest) { this._finals.push(rest); this._interim = ''; this._emit('result', { resultIndex: this._finals.length - 1, results: resultList(this._results()) }); }
            this._emit('end');
          }, 40));
        }
        if (!this._done) this._timers.push(setTimeout(step, w.__fake.stepMs));
      };
      this._timers.push(setTimeout(step, 30));
    }
    stop() {
      if (!this._running) return;
      this._running = false;
      this._timers.forEach(clearTimeout);
      const words = this._words || [];
      const said = this._finals.join(' ').split(/\s+/).filter(Boolean).length;
      const rest = words.slice(said).join(' ');
      setTimeout(() => {
        if (rest) { this._finals.push(rest); this._interim = ''; this._emit('result', { resultIndex: this._finals.length - 1, results: resultList(this._results()) }); }
        this._emit('end');
      }, 20);
    }
    abort() {
      const was = this._running;
      this._running = false;
      this._timers.forEach(clearTimeout);
      if (was) setTimeout(() => this._emit('end'), 0);
    }
  }
  w.SpeechRecognition = FakeSR;
  w.webkitSpeechRecognition = FakeSR;

  if (navigator.mediaDevices) {
    w.__fake.gum = 0;
    navigator.mediaDevices.getUserMedia = async () => {
      w.__fake.gum++;
      const ac = new (w.AudioContext)();
      const o = ac.createOscillator();
      const g = ac.createGain();
      g.gain.value = 0.2;
      const d = ac.createMediaStreamDestination();
      o.connect(g).connect(d);
      o.start();
      return d.stream;
    };
  }
}

export const test = base.extend({
  micMode: ['mic', { option: true }],
  fixedDate: [null, { option: true }],
  errors: async ({ page }, use) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await use(errors);
  },
  page: async ({ page, micMode, fixedDate }, use) => {
    const external = [];
    await page.route(/^https?:\/\/fonts\.(googleapis|gstatic)\.com\//, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    page.on('request', (r) => {
      const u = new URL(r.url());
      if (['http:', 'https:'].includes(u.protocol) && !['127.0.0.1', 'localhost'].includes(u.hostname) && !/^fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) external.push(r.url());
    });
    if (fixedDate) await page.clock.setFixedTime(new Date(fixedDate));
    await page.addInitScript(initFakes, micMode);
    await use(page);
    expect(external, 'no external network calls').toEqual([]);
  },
});

test.afterEach(async ({ errors }, info) => {
  // Every test fails on any console error or uncaught page error.
  if (info.status === 'passed' || info.status === info.expectedStatus) {
    expect(errors, 'console and page errors').toEqual([]);
  }
});

export { expect };

// ---------- helpers ----------

// Storage is set from a same-origin page without the app, so the app cannot overwrite it.
export async function setStore(page, value) {
  await page.goto('manifest.webmanifest');
  await page.evaluate(([k, v]) => { localStorage.clear(); if (v) localStorage.setItem(k, JSON.stringify(v)); }, [STORE_KEY, value]);
}

export async function fresh(page, path = '?nosw#home') {
  await setStore(page, null);
  await page.goto(path);
}

// Skip the onboarding UI: store a minimal onboarded state, the engine fills the rest.
export async function seed(page, name = 'Alex') {
  await setStore(page, { v: 1, onboarded: true, name });
  await page.goto('?nosw#home');
  await expect(page).toHaveURL(/#home$/);
}

// Walk the onboarding UI. Tolerates extra optional steps: fills the name, then presses forward.
export async function onboard(page, name = 'Alex') {
  await fresh(page);
  await expect(page).toHaveURL(/#onboarding$/);
  const forward = page.locator('[data-testid="onboarding-next"], [data-next]').or(page.getByRole('button', { name: /^(הבא|מתחילים|המשך|סיום|סיימתי)/ })).first();
  let named = false;
  for (let i = 0; i < 20 && !/#home$/.test(page.url()); i++) {
    const field = page.getByLabel(/איך לקרוא לך|השם שלך/).first();
    if (!named && await field.isVisible().catch(() => false)) { await field.fill(name); named = true; }
    if (await forward.isVisible().catch(() => false)) await forward.click();
    else await page.getByRole('button', { name: /דלג/ }).first().click();
    await page.waitForTimeout(150);
  }
  await expect(page).toHaveURL(/#home$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(name);
}

export async function state(page) {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), STORE_KEY);
}

// Today's task list from the store, whatever the schema version keeps around it.
export async function tasksOf(page) {
  const st = await state(page);
  return (st && st.daily && st.daily.tasks) || [];
}

export async function itemsById(page) {
  return page.evaluate(async () => {
    const m = await import('./js/content.js');
    return Object.fromEntries(m.ITEMS.map((i) => [i.id, i]));
  });
}

// Close any open modal (mission complete, level up). Returns the list of modal titles seen.
export async function dismissModals(page, waitMs = 2500) {
  const seen = [];
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    const m = page.getByRole('dialog');
    if (await m.count()) {
      seen.push((await m.getAttribute('aria-label')) || (await m.locator('h2').first().textContent()) || '');
      await m.locator('button').last().click();
      await expect(m).toHaveCount(0);
      continue;
    }
    await page.waitForTimeout(150);
  }
  return seen;
}

export async function noHScroll(page, label = '') {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bw: document.body.scrollWidth }));
  expect(r.sw, `horizontal scroll on ${label}`).toBeLessThanOrEqual(r.cw);
  expect(r.bw, `body overflow on ${label}`).toBeLessThanOrEqual(r.cw);
}

// Basic a11y checks without axe: names on controls, decorative svg hidden, English blocks LTR.
export async function a11y(page, label = '') {
  const issues = await page.evaluate(() => {
    const out = [];
    const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length) && getComputedStyle(el).visibility !== 'hidden';
    const name = (el) => {
      const l = el.getAttribute('aria-label');
      if (l && l.trim()) return l.trim();
      const lb = el.getAttribute('aria-labelledby');
      if (lb) return lb.split(/\s+/).map((id) => document.getElementById(id)?.textContent || '').join(' ').trim();
      const t = (el.innerText || el.textContent || '').trim();
      if (t) return t;
      return (el.getAttribute('title') || '').trim();
    };
    document.querySelectorAll('button, a[href], [role="button"], [role="switch"], [role="radio"], input, textarea, select, summary').forEach((el) => {
      if (!visible(el)) return;
      if (el.matches('input, textarea, select')) {
        const lab = el.closest('label') || (el.id && document.querySelector(`label[for="${el.id}"]`));
        if (!lab && !el.getAttribute('aria-label')) out.push(`unlabeled field ${el.outerHTML.slice(0, 80)}`);
        return;
      }
      if (!name(el)) out.push(`no name: ${el.outerHTML.slice(0, 100)}`);
    });
    document.querySelectorAll('svg').forEach((s) => {
      const hidden = s.closest('[aria-hidden="true"]');
      const labelled = s.getAttribute('role') === 'img' && (s.getAttribute('aria-label') || s.querySelector('title'));
      if (!hidden && !labelled) out.push(`svg not hidden: ${s.outerHTML.slice(0, 80)}`);
    });
    document.querySelectorAll('img').forEach((i) => { if (!i.hasAttribute('alt')) out.push('img without alt'); });
    document.querySelectorAll('[lang="en"]').forEach((el) => {
      if (getComputedStyle(el).direction !== 'ltr') out.push(`lang=en not ltr: ${el.className}`);
    });
    const de = document.documentElement;
    if (de.lang !== 'he' || de.dir !== 'rtl') out.push(`html lang/dir ${de.lang}/${de.dir}`);
    const ids = {};
    document.querySelectorAll('[id]').forEach((e) => { ids[e.id] = (ids[e.id] || 0) + 1; });
    Object.entries(ids).filter(([, n]) => n > 1).forEach(([id]) => out.push(`duplicate id ${id}`));
    return out;
  });
  expect(issues, `a11y on ${label}`).toEqual([]);
}

// Speak into the fake mic: set the transcript, tap the mic, wait for words, tap again.
export async function speak(page, text, { minWords = 2 } = {}) {
  await page.evaluate((t) => { window.__fake.text = t; }, text);
  const core = page.getByTestId('stage').getByTestId('mic').first();
  await expect(core).toBeEnabled();
  await core.click();
  await expect(page.getByTestId('stage').locator('.mic')).toHaveAttribute('data-state', 'listening');
  const n = Math.min(minWords, text.split(/\s+/).length);
  await page.waitForFunction((k) => {
    const tx = document.querySelector('[data-testid="stage"] [data-testid="transcript"]');
    return tx && tx.textContent.trim().split(/\s+/).length >= k;
  }, n);
  await page.waitForFunction(() => window.__fake.finished === true, null, { timeout: 60_000 });
  await page.waitForTimeout(120);
  await core.click();
}

// Play the current item in the play screen. mode 'mic' uses the fake mic, 'nomic' uses fallbacks.
export async function playItem(page, it, k, mode, { allRight = false } = {}) {
  const stage = page.getByTestId('stage');
  if (it.type === 'choice') {
    const pick = k === 1 && !allRight ? (it.correct + 1) % it.options.length : it.correct;
    await stage.locator(`.opt[data-k="${pick}"]`).click();
    await expect(stage.locator('.opt.picked')).toHaveCount(1);
    return pick === it.correct ? 'right' : 'wrong';
  }
  if (it.type === 'qa') {
    await stage.locator('[data-skip]').click();
    await expect(stage.locator('[data-mic]')).toBeVisible();
  }
  const sayText = it.type === 'fix' ? it.right : it.type === 'shadow' ? it.sentence_en : it.type === 'qa' ? it.model_en
    : it.type === 'recall' ? it.text_en : SCRIPT;
  if (allRight) {
    // Natural pace (about 150 wpm) for free speaking, so the score reflects the words.
    const pace = it.type === 'speak' || it.type === 'qa' ? 400 : 35;
    await page.evaluate((ms) => { window.__fake.stepMs = ms; }, pace);
    await speak(page, it.type === 'speak' ? it.model_en : sayText);
    await page.evaluate(() => { window.__fake.stepMs = 35; });
    return 'speech';
  }
  if (mode === 'mic') {
    if (it.type === 'fix' && k === 2) {
      // Show the answer, then say it aloud (repeat after): 60 % of the score.
      await stage.getByTestId('fix-answer').click();
      await expect(stage.getByTestId('fix-answer-box')).toBeVisible();
      await speak(page, it.right);
      return 'peek';
    }
    if (it.type === 'speak') {
      await speak(page, SCRIPT, { minWords: 6 });
      return 'speech';
    }
    await speak(page, sayText);
    return 'speech';
  }
  // No mic: self rating for shadow, hint then typed for the second fix, typed for the rest.
  // The no-mic note shows in full once per session, then as a small chip by the mic.
  await expect(stage.locator('.mic-note:not([hidden]), .mic-chip').first()).toBeVisible();
  if (it.type === 'shadow') {
    await stage.getByTestId('mic-self').click();
    await stage.getByTestId('stars').locator('[data-star="4"]').click();
    return 'self';
  }
  if (it.type === 'fix' && k === 1) {
    // Hint, then type the corrected sentence.
    await stage.getByTestId('fix-hint').click();
    await stage.getByTestId('mic-type').click();
    await stage.getByTestId('typed').fill(sayText);
    await stage.getByTestId('typed-check').click();
    return 'peek';
  }
  await stage.getByTestId('mic-type').click();
  await stage.getByTestId('typed').fill(sayText);
  await stage.getByTestId('typed-check').click();
  return 'typed';
}

// Play every task of today's mission. Returns { kinds, results } for assertions.
export async function playMission(page, mode, { shots = null } = {}) {
  const st = await state(page);
  const byId = await itemsById(page);
  const tasks = st.daily.tasks;
  expect(tasks).toHaveLength(5);
  const seenTypes = [];
  await page.goto('?nosw#mission');
  await page.getByTestId('mission-start').click();
  await expect(page).toHaveURL(/#play$/);
  for (const [ti, t] of tasks.entries()) {
    await expect(page.getByTestId('play-kicker')).toContainText(`שלב ${ti + 1} מתוך 5`);
    for (const [k, id] of t.itemIds.entries()) {
      const it = byId[id];
      seenTypes.push(it.type);
      if (shots && k === 0) await shots(`task${ti + 1}-${it.type}`);
      await playItem(page, it, k, mode);
      const nb = page.getByTestId('feedback-next');
      await expect(nb).toBeVisible();
      if (shots && k === 0) await shots(`task${ti + 1}-${it.type}-feedback`);
      await nb.click();
    }
    await expect(page.getByTestId('result')).toBeVisible();
    if (shots) { await page.waitForTimeout(1300); await shots(`result-${ti + 1}`); }
    const modals = await dismissModals(page, ti === tasks.length - 1 ? 4000 : 1800);
    if (ti === tasks.length - 1) {
      expect(modals[0]).toContain('המשימה הושלמה');
      break;
    }
    await page.getByTestId('result-next').click();
    await expect(page.getByTestId('play-kicker')).toBeVisible();
  }
  return { seenTypes };
}

// Two dates in a row, so one day has a Q&A boss and the other a recall boss.
export const DAY_A = '2026-10-21T10:00:00+03:00';
export const DAY_B = '2026-10-22T10:00:00+03:00';
