// speech.js - microphone, live speech-to-text and local recording. Browser only.
//
// Privacy model (plain English):
// - The app never uploads audio and never saves it. The recording lives only in
//   memory as a blob URL. discard() and cancel() free it and turn the mic off.
//   Nothing about audio is written to localStorage, IndexedDB or any server.
// - Speech-to-text uses the browser's own speech service. When on-device mode is
//   active, Chrome turns speech into text on the phone itself. When it is not,
//   the browser's speech service (Google, in Chrome) receives the audio to produce
//   the text. That is the browser's service, not this app.
// - With onDevice 'on' the app never falls back to the cloud service. If local
//   recognition is not available it reports 'ondevice-unavailable' and only records.
//
// Exports (see CONTRACT.md):
//   support()        -> { recognition, onDevice:'yes'|'no'|'unknown', recorder, secure }
//   createSession()  -> { start, stop, cancel, discard }
// Extra helpers:
//   platform()            -> { mobile, ios, android }  from userAgentData.mobile or the UA
//   micPermission()       -> Promise<'granted'|'prompt'|'denied'|'unknown'>  never rejects
//
// Mic ownership: on mobile (Android, iOS) SpeechRecognition and getUserMedia fight for the
// mic. There, a take with recognition never opens getUserMedia (no recorder, no level meter).
// Recognition alone owns the mic, and the caller drives a visual level from onActivity().
// A take with recognize:false is the explicit "record to listen" mode (no transcript).
//   probeOnDevice(lang)   -> Promise<'yes'|'no'|'unknown'>  explicit only, 3 s timeout, cached
//   cachedOnDevice(lang)  -> 'yes'|'no'|'unknown'|null    last probe result, no probe
//   installOnDevice(lang) -> Promise<boolean>  asks Chrome to download the local model (call from a tap)

const g = globalThis;

function getSR() {
  try { return g.SpeechRecognition || g.webkitSpeechRecognition || null; } catch { return null; }
}

const onDeviceCache = new Map(); // lang -> 'yes'|'no'|'unknown'
const probeInflight = new Map(); // lang -> Promise, so parallel calls share one probe
const PROBE_TIMEOUT_MS = 3000;
const MIC_TIMEOUT_MS = 6000; // only after permission is granted
const PROMPT_TIMEOUT_MS = 60000; // permission state unknown: a prompt may be open
const PERM_QUERY_MS = 400;
const FAST_RUN_MS = 1000; // a recognition run shorter than this, with no result, is a failed run
const MAX_FAST_RUNS = 3; // then give up on recognition for this take ('rec-failed')
const START_TIMEOUT_MS = 5000; // exclusive take: no recognition onstart this long after permission is granted

/** Platform flags. Never throws. iPadOS reports a Mac UA, so touch points decide there. */
export function platform() {
  const out = { mobile: false, ios: false, android: false, brave: false };
  try {
    const nav = g.navigator || {};
    const ua = String(nav.userAgent || '');
    out.android = /Android/i.test(ua);
    out.ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && Number(nav.maxTouchPoints) > 1);
    const uad = nav.userAgentData;
    out.mobile = out.android || out.ios || !!(uad && uad.mobile === true) || /Mobi/i.test(ua);
    // Brave ships the Web Speech API but blocks its speech service, so every take fails.
    out.brave = !!nav.brave;
  } catch { /* never throw */ }
  return out;
}

/** Mic permission state without prompting. 'unknown' when the browser cannot tell. Never rejects. */
export async function micPermission(timeoutMs = PERM_QUERY_MS) {
  try {
    const P = g.navigator && g.navigator.permissions;
    if (!P || typeof P.query !== 'function') return 'unknown';
    let raw;
    try { raw = P.query({ name: 'microphone' }); } catch { return 'unknown'; }
    const st = await withTimeout(raw, timeoutMs);
    const v = st && st.state;
    return v === 'granted' || v === 'prompt' || v === 'denied' ? v : 'unknown';
  } catch {
    return 'unknown';
  }
}

async function permStatus(timeoutMs) {
  try {
    const P = g.navigator && g.navigator.permissions;
    if (!P || typeof P.query !== 'function') return null;
    let raw;
    try { raw = P.query({ name: 'microphone' }); } catch { return null; }
    return (await withTimeout(raw, timeoutMs)) || null;
  } catch { return null; }
}

/** Last probe result for `lang`, or null if probeOnDevice() has not finished yet. Never throws. */
export function cachedOnDevice(lang = 'en-US') {
  try { return onDeviceCache.has(lang) ? onDeviceCache.get(lang) : null; } catch { return null; }
}

/**
 * Ask Chrome whether local recognition is ready for `lang`. Never throws, never rejects.
 * Only runs when called explicitly (support() does not probe: SpeechRecognition.available()
 * crashed a headless Chromium page). Times out after 3 s with 'unknown'. Result is cached.
 */
export function probeOnDevice(lang = 'en-US', { timeoutMs = PROBE_TIMEOUT_MS } = {}) {
  try {
    if (onDeviceCache.has(lang)) return Promise.resolve(onDeviceCache.get(lang));
    if (probeInflight.has(lang)) return probeInflight.get(lang);
    const p = runProbe(lang, timeoutMs).then((res) => {
      onDeviceCache.set(lang, res);
      probeInflight.delete(lang);
      return res;
    }, () => { probeInflight.delete(lang); onDeviceCache.set(lang, 'unknown'); return 'unknown'; });
    probeInflight.set(lang, p);
    return p;
  } catch {
    return Promise.resolve('unknown');
  }
}

async function runProbe(lang, timeoutMs) {
  try {
    const SR = getSR();
    if (!SR) return 'no';
    let call = null;
    if (typeof SR.available === 'function') call = () => SR.available({ langs: [lang], processLocally: true });
    else if (typeof SR.availableOnDevice === 'function') call = () => SR.availableOnDevice(lang); // older Chrome draft
    else return 'unknown';
    let raw;
    try { raw = call(); } catch { return 'unknown'; }
    const status = await withTimeout(raw, timeoutMs);
    return status === 'available' ? 'yes' : status == null ? 'unknown' : 'no';
  } catch {
    return 'unknown';
  }
}

/** Ask Chrome to download the local speech model. Returns true when it reports success. Never throws. */
export async function installOnDevice(lang = 'en-US') {
  try {
    const SR = getSR();
    if (!SR) return false;
    let ok = false;
    if (typeof SR.install === 'function') ok = await SR.install({ langs: [lang], processLocally: true });
    else if (typeof SR.installOnDevice === 'function') ok = await SR.installOnDevice(lang);
    onDeviceCache.delete(lang);
    return ok !== false;
  } catch {
    try { onDeviceCache.delete(lang); } catch { /* ignore */ }
    return false;
  }
}

/** Synchronous feature check. Never probes. onDevice is 'unknown' until probeOnDevice() has finished once. */
export function support(lang = 'en-US') {
  const out = { recognition: false, onDevice: 'unknown', recorder: false, secure: false };
  try {
    const SR = getSR();
    out.recognition = !!SR;
    out.secure = !!g.isSecureContext;
    out.recorder = typeof g.MediaRecorder === 'function' &&
      !!(g.navigator && g.navigator.mediaDevices && typeof g.navigator.mediaDevices.getUserMedia === 'function');
    if (!SR) out.onDevice = 'no';
    else if (onDeviceCache.has(lang)) out.onDevice = onDeviceCache.get(lang);
  } catch { /* never throw */ }
  return out;
}

function withTimeout(p, ms) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    Promise.resolve(p).then((v) => { clearTimeout(t); resolve(v); }, () => { clearTimeout(t); resolve(null); });
  });
}

const now = () => (g.performance && g.performance.now ? g.performance.now() : Date.now());

// iOS: 'service-not-allowed' means Siri and Dictation are off, not a blocked mic.
function mapRecError(code, local, ios) {
  switch (code) {
    case 'not-allowed': return 'not-allowed';
    case 'service-not-allowed': return local ? 'ondevice-unavailable' : ios ? 'dictation-off' : 'service-off';
    case 'language-not-supported': return local ? 'ondevice-unavailable' : 'unsupported';
    case 'no-speech': return 'no-speech';
    case 'network': return 'network';
    case 'audio-capture': return 'audio-capture';
    case 'aborted': return 'aborted';
    default: return local ? 'ondevice-unavailable' : 'network';
  }
}

function mapMediaError(e) {
  const n = e && e.name;
  if (n === 'NotAllowedError' || n === 'SecurityError') return 'not-allowed';
  if (n === 'NotFoundError' || n === 'NotReadableError' || n === 'OverconstrainedError' || n === 'AbortError') return 'audio-capture';
  return 'audio-capture';
}

// Join final segments. Android Chrome sometimes repeats a phrase in the next final
// ("we are" then "we are going"). Compared by whole words, never by characters:
// - the new segment starts with all words of the previous one: it replaces it;
// - the previous one ends with all words of the new one (2 words or more): it is a repeat, drop it.
// "I" then "It works" keeps both; "deploy now" then "now" keeps both.
const wordsOf = (s) => s.toLowerCase().split(/\s+/).map((w) => w.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, '')).filter(Boolean);
function startsWithWords(a, b) { return b.length <= a.length && b.every((w, i) => a[i] === w); }
function endsWithWords(a, b) { const k = a.length - b.length; return k >= 0 && b.every((w, i) => a[k + i] === w); }
export function joinSegments(segs) {
  const out = [];
  for (const raw of segs) {
    const s = String(raw || '').trim();
    if (!s) continue;
    const prev = out[out.length - 1];
    if (prev) {
      const pw = wordsOf(prev), sw = wordsOf(s);
      if (pw.length && startsWithWords(sw, pw)) { out[out.length - 1] = s; continue; }
      if (sw.length >= 2 && endsWithWords(pw, sw)) continue;
    }
    out.push(s);
  }
  return out.join(' ');
}

// Errors that end recognition for this take. Per take only: the next take tries again.
const FATAL = new Set(['not-allowed', 'service-not-allowed', 'audio-capture', 'network', 'language-not-supported']);

const EMPTY = () => ({ transcript: '', durationSec: 0, audioUrl: null });

// MediaRecorder format: Chrome and Firefox take webm/opus, Safari (iOS too) takes mp4.
// When none is reported as supported, let the browser pick its default.
const MIME_TYPES = ['audio/webm;codecs=opus', 'audio/mp4'];
function pickMime(MR) {
  try {
    if (!MR || typeof MR.isTypeSupported !== 'function') return '';
    return MIME_TYPES.find((t) => { try { return MR.isTypeSupported(t); } catch { return false; } }) || '';
  } catch { return ''; }
}

function killStream(s) {
  try { if (s && s.getTracks) s.getTracks().forEach((t) => { try { t.stop(); } catch { /* ignore */ } }); } catch { /* ignore */ }
}


/**
 * One practice take. onDevice: 'auto' (local when the cached probe says ready, else browser service;
 * never probes inside a take), 'on' (local only, never the cloud), 'off' (browser service).
 * Options (all optional):
 *   record        MediaRecorder for playback (in memory only).
 *   recognize     default true. false = the "record to listen" take: mic + recorder, no transcript.
 *   exclusiveMic  default platform().mobile. With recognition, never open getUserMedia: no recorder,
 *                 no level meter. Recognition alone owns the mic.
 *   ios           default platform().ios. Non-continuous recognition, and no automatic restart:
 *                 Safari may refuse a start() outside a user tap. When the recognizer ends on its own,
 *                 the take keeps what was heard and onEnded() fires; the caller stops the take and can
 *                 offer a "continue" tap (a new take, inside a user gesture).
 *   restart       default !ios. Restart recognition when it ends on its own (Android, desktop).
 *   onEnded()     recognition ended on its own and will not restart (restart:false). Call stop().
 *   audioCtx      an AudioContext created and resumed inside the tap (iOS and Safari need that). Used
 *                 for the level meter and closed when the take ends.
 *   onReady()     the take really listens now: recognition onstart, or the recorder started when there is
 *                 no recognition. Start the countdown here, not at the tap.
 *   onPermission('prompt'|'granted')  a mic permission prompt is open / was answered.
 *   onActivity(kind)  kind: 'start'|'sound'|'speech'|'result'|'soundend'|'speechend'. Recognition events,
 *                 so the UI can animate a level without a mic stream.
 *   onInterim(text), onFinal(text, segment), onLevel(0..1), onError(code)
 * Error codes, all per take: not-allowed (permission denied), audio-capture, network, no-speech,
 *   unsupported, ondevice-unavailable, dictation-off (iOS: Siri and Dictation off), service-off,
 *   mic-timeout (no mic stream 6 s after permission was granted, or on an exclusive take no recognition
 *   onstart 5 s after permission was granted), rec-failed (recognition kept ending at once, a restarted
 *   run failed to start, gave up for this take). A restarted run never reports not-allowed.
 *   The browser permission prompt never counts toward a timeout.
 * No public method throws. start() never rejects; problems go to onError(code).
 * stop(), cancel() and discard() are idempotent and safe in any order, even before start() resolves.
 * The page going hidden while recording stops the take gracefully (Android cuts the mic in background).
 * micTimeoutMs / promptTimeoutMs / probeTimeoutMs / startTimeoutMs are for tests.
 */
export function createSession(opts = {}) {
  try {
    return makeSession(opts || {});
  } catch {
    // Should never happen. Return a session that does nothing rather than throwing into the UI.
    const err = opts && typeof opts.onError === 'function' ? opts.onError : null;
    return {
      start: () => { try { err && err('unsupported'); } catch { /* ignore */ } return Promise.resolve(); },
      stop: () => Promise.resolve(EMPTY()),
      cancel: () => 'done',
      discard: () => {},
    };
  }
}

function makeSession({
  lang = 'en-US', onDevice = 'auto', record = true, recognize = true, exclusiveMic, ios, restart, audioCtx: givenCtx = null,
  onInterim, onFinal, onLevel, onError, onReady, onPermission, onActivity, onEnded,
  micTimeoutMs = MIC_TIMEOUT_MS, promptTimeoutMs = PROMPT_TIMEOUT_MS, probeTimeoutMs = PROBE_TIMEOUT_MS,
  startTimeoutMs = START_TIMEOUT_MS,
}) {
  const plat = platform();
  const exclusive = exclusiveMic == null ? plat.mobile : !!exclusiveMic;
  const isIOS = ios == null ? plat.ios : !!ios;
  const autoRestart = restart == null ? !isIOS : !!restart;
  const SR = recognize ? getSR() : null;
  let state = 'idle'; // idle | starting | recording | stopping | done
  let stream = null, audioCtx = givenCtx, levelTimer = null;
  let recorder = null, chunks = [], audioUrl = null, mime = '';
  let rec = null, local = false, recActive = false, recDisabled = false;
  let committed = []; // finals (and last interim words) from earlier recognition runs
  let runFinals = []; // finals of the current run, by result index
  let interim = '';
  let t0 = 0, tStart = 0, t1 = 0;
  let ready = false;
  let runStart = 0, runHadResult = false, fastRuns = 0, runs = 0;
  let startTimer = null, permWatch = null; // exclusive take: no onstart in time
  let sawNoSpeech = false;
  let endWaiters = [];
  let abortMic = null; // resolves a pending getUserMedia wait early
  let stopPromise = null;
  let cancelled = false;
  let visBound = false;

  const call = (f, ...a) => { try { if (typeof f === 'function') f(...a); } catch { /* ignore UI errors */ } };
  const emitErr = (code) => call(onError, code);
  const act = (kind) => call(onActivity, kind);
  const finalText = () => joinSegments([...committed, ...runFinals]);
  const runningText = () => joinSegments([...committed, ...runFinals, interim]);
  const duration = () => { const a = t0 || tStart; return a && t1 ? Math.max(0, Math.round((t1 - a) / 100) / 10) : 0; };
  const flushWaiters = () => { const w = endWaiters; endWaiters = []; w.forEach((f) => { try { f(); } catch { /* ignore */ } }); };

  function clearStartTimer() {
    if (startTimer) { try { clearTimeout(startTimer); } catch { /* ignore */ } startTimer = null; }
    if (permWatch) { try { permWatch.onchange = null; } catch { /* ignore */ } permWatch = null; }
  }

  function markReady() {
    if (ready || state !== 'recording') return;
    ready = true;
    clearStartTimer();
    t0 = now();
    call(onReady);
  }

  function stopTracks() {
    if (levelTimer) { try { clearInterval(levelTimer); } catch { /* ignore */ } levelTimer = null; }
    if (stream) { killStream(stream); stream = null; }
    if (audioCtx) { try { const p = audioCtx.close(); if (p && p.catch) p.catch(() => {}); } catch { /* ignore */ } audioCtx = null; }
  }

  // Page visibility: when the page goes hidden mid-take, end it gracefully. While 'starting' only
  // pagehide counts: the Android system permission dialog can hide the page for a moment.
  function onVisibility() {
    try {
      const d = g.document;
      const hidden = d && (d.hidden === true || d.visibilityState === 'hidden');
      if (hidden && state === 'recording') doStop();
    } catch { /* ignore */ }
  }
  function onPageHide() {
    try { if (state === 'recording' || state === 'starting') doStop(); } catch { /* ignore */ }
  }
  function bindVisibility() {
    try {
      if (visBound) return;
      const d = g.document;
      if (d && typeof d.addEventListener === 'function') d.addEventListener('visibilitychange', onVisibility);
      if (typeof g.addEventListener === 'function') g.addEventListener('pagehide', onPageHide);
      visBound = true;
    } catch { /* ignore */ }
  }
  function unbindVisibility() {
    try {
      if (!visBound) return;
      visBound = false;
      const d = g.document;
      if (d && typeof d.removeEventListener === 'function') d.removeEventListener('visibilitychange', onVisibility);
      if (typeof g.removeEventListener === 'function') g.removeEventListener('pagehide', onPageHide);
    } catch { /* ignore */ }
  }

  function startLevel() {
    if (!stream || typeof onLevel !== 'function') return;
    try {
      if (!audioCtx) {
        const AC = g.AudioContext || g.webkitAudioContext;
        if (!AC) return;
        audioCtx = new AC();
      }
      const src = audioCtx.createMediaStreamSource(stream);
      const an = audioCtx.createAnalyser();
      an.fftSize = 1024;
      src.connect(an);
      const buf = new Uint8Array(an.fftSize);
      let smooth = 0;
      levelTimer = setInterval(() => {
        try {
          an.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
          const rms = Math.sqrt(sum / buf.length);
          const lvl = Math.min(1, rms * 4);
          smooth = lvl > smooth ? lvl : smooth * 0.8 + lvl * 0.2;
          onLevel(Math.round(smooth * 100) / 100);
        } catch { /* ignore */ }
      }, 50); // about 20 fps
      if (audioCtx.state === 'suspended' && audioCtx.resume) { const p = audioCtx.resume(); if (p && p.catch) p.catch(() => {}); }
    } catch { /* level meter is optional */ }
  }

  function startRecorder() {
    const MR = g.MediaRecorder;
    if (!record || !stream || typeof MR !== 'function') return;
    try {
      mime = pickMime(MR);
      try {
        recorder = mime ? new MR(stream, { mimeType: mime }) : new MR(stream);
      } catch {
        mime = '';
        recorder = new MR(stream); // browser default format
      }
      chunks = [];
      recorder.ondataavailable = (e) => { if (e && e.data && e.data.size) chunks.push(e.data); };
      recorder.start(1000);
    } catch { recorder = null; }
  }

  function newRecognition() {
    const r = new SR();
    r.lang = lang;
    r.continuous = !isIOS; // iOS ends after a pause anyway; onend restarts it
    r.interimResults = true;
    r.maxAlternatives = 1;
    if (local) {
      if ('processLocally' in r) r.processLocally = true;
      else if ('mode' in r) r.mode = 'ondevice-only'; // older Chrome draft
    }
    r.onstart = () => { if (rec !== r) return; runStart = now(); markReady(); act('start'); };
    r.onaudiostart = () => { if (rec === r) markReady(); };
    r.onsoundstart = () => { if (rec !== r) return; markReady(); act('sound'); };
    r.onspeechstart = () => { if (rec !== r) return; markReady(); act('speech'); };
    r.onsoundend = () => { if (rec === r) act('soundend'); };
    r.onspeechend = () => { if (rec === r) act('speechend'); };
    r.onresult = (ev) => {
      try {
        runHadResult = true;
        markReady();
        act('result');
        let inter = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const res = ev.results[i];
          const txt = res && res[0] ? res[0].transcript : '';
          if (res && res.isFinal) {
            runFinals[i] = txt;
            call(onFinal, finalText(), String(txt || '').trim());
          } else {
            inter += txt;
          }
        }
        runFinals = runFinals.filter((x) => x !== undefined);
        interim = inter.trim();
        call(onInterim, runningText());
      } catch { /* ignore malformed events */ }
    };
    r.onerror = (ev) => {
      if (rec !== r) return;
      const code = ev && ev.error;
      if (code === 'no-speech') { sawNoSpeech = true; return; } // Android: restart quietly
      if (code === 'aborted') return; // our own stop, or Android ending early: onend counts it
      if (runs > 1 && (code === 'not-allowed' || code === 'service-not-allowed')) {
        // A restarted run was refused (no user gesture). The mic works: never report a denied permission.
        recDisabled = true;
        emitErr('rec-failed');
        return;
      }
      if (FATAL.has(code)) recDisabled = true;
      if (local && onDevice === 'auto') {
        // Auto mode tried on-device and it failed: use the browser service from the next take on.
        onDeviceCache.set(lang, 'no');
        emitErr('local-failed');
        return;
      }
      emitErr(mapRecError(code, local, isIOS));
    };
    r.onend = () => {
      if (rec !== r) return;
      recActive = false;
      // Keep the finals of this run, and the last interim words too: when Android ends a run itself
      // (silence, network blip) no final may come. A repeat in the next run is merged by joinSegments.
      committed.push(...runFinals);
      if (interim) committed.push(interim);
      runFinals = [];
      interim = '';
      if (state === 'recording' && !recDisabled && !autoRestart) {
        // iOS: no restart outside a user tap. Keep what was heard and let the caller end the take.
        recDisabled = true;
        flushWaiters();
        if (!ready && !committed.length) emitErr('rec-failed');
        else call(onEnded);
        return;
      }
      if (state === 'recording' && !recDisabled) {
        // A run that ended fast with no result is a failed run (Android: mic busy; each start beeps).
        const fast = !runHadResult && now() - runStart < FAST_RUN_MS;
        fastRuns = fast ? fastRuns + 1 : 0;
        if (fastRuns >= MAX_FAST_RUNS) { recDisabled = true; emitErr('rec-failed'); flushWaiters(); return; }
        setTimeout(() => { if (state === 'recording' && !recDisabled) startRec(); }, fastRuns ? 400 : 50);
        return;
      }
      flushWaiters();
    };
    return r;
  }

  function startRec() {
    runHadResult = false;
    runStart = now();
    runs++;
    try {
      rec = newRecognition();
      recActive = true;
      rec.start();
    } catch {
      recActive = false;
      recDisabled = true;
      emitErr('rec-failed');
    }
  }

  // Resolves { stream } | { error } | { timeout } | { aborted }. A stream that arrives after we gave
  // up is stopped at once, so the mic is never left on. The timeout runs only once permission is
  // granted: while the browser prompt is open we wait (the user may read it for a while).
  async function getMic() {
    const st = await permStatus(PERM_QUERY_MS);
    if (state !== 'starting') return { aborted: true };
    const perm = st && st.state;
    return new Promise((resolve) => {
      let settled = false, timer = null;
      const finish = (v) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        abortMic = null;
        try { if (st && perm === 'prompt') st.onchange = null; } catch { /* ignore */ }
        resolve(v);
      };
      const arm = (ms) => { if (timer) clearTimeout(timer); timer = setTimeout(() => finish({ timeout: true }), ms); };
      if (perm === 'granted') arm(micTimeoutMs);
      else if (perm === 'prompt') {
        call(onPermission, 'prompt');
        try {
          st.onchange = () => {
            try { if (!settled && st.state === 'granted') { call(onPermission, 'granted'); arm(micTimeoutMs); } } catch { /* ignore */ }
          };
        } catch { /* ignore */ }
      } else arm(promptTimeoutMs); // 'denied' rejects fast; unknown: a prompt may be open
      abortMic = () => finish({ aborted: true });
      let p;
      try {
        p = g.navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      } catch (e) { finish({ error: e }); return; }
      Promise.resolve(p).then(
        (s) => {
          if (settled) { killStream(s); return; }
          if (perm === 'prompt') call(onPermission, 'granted');
          finish({ stream: s });
        },
        (e) => finish({ error: e }),
      );
    });
  }

  async function chooseLocal() {
    if (onDevice === 'off') return { use: false, ok: true };
    let status = cachedOnDevice(lang);
    if (onDevice === 'on') {
      // Local only, chosen by the user. Probe here if no result is cached yet.
      if (status == null) status = await probeOnDevice(lang, { timeoutMs: probeTimeoutMs });
      // Without a working local model we never send audio to the cloud.
      let canSet = false;
      try { const probe = new SR(); canSet = 'processLocally' in probe || 'mode' in probe; } catch { canSet = false; }
      return status === 'yes' && canSet ? { use: true, ok: true } : { use: false, ok: false };
    }
    // auto: only the cached probe result (Profile runs the probe on a tap). No probe inside a take.
    return { use: status === 'yes', ok: true };
  }

  async function doStart() {
    if (state !== 'idle') return;
    state = 'starting';
    bindVisibility();
    try {
      // Recognition choice first: it decides whether this take may open the mic itself.
      let useRec = false;
      if (recognize) {
        if (!SR) emitErr('unsupported');
        else if (platform().brave) emitErr('brave'); // known not to work: record only, never retry
        else {
          const c = await chooseLocal();
          if (state !== 'starting') { stopTracks(); return; }
          if (!c.ok) emitErr('ondevice-unavailable');
          else { local = c.use; useRec = true; }
        }
      }
      recDisabled = !useRec;
      const exclusiveTake = useRec && exclusive;

      const md = g.navigator && g.navigator.mediaDevices;
      if (!exclusiveTake && md && typeof md.getUserMedia === 'function' && (record || onLevel || !recognize)) {
        const r = await getMic();
        if (r.stream) {
          if (state !== 'starting') { killStream(r.stream); return; } // stopped or cancelled meanwhile
          stream = r.stream;
        } else if (r.timeout) {
          // No stream 6 s after permission (seen in headless Chrome). Give up on this take only.
          if (state !== 'starting') return;
          stopTracks();
          state = 'done';
          unbindVisibility();
          emitErr('mic-timeout');
          return;
        } else if (r.aborted) {
          return;
        } else if (r.error) {
          if (state !== 'starting') return;
          const code = mapMediaError(r.error);
          if (code === 'not-allowed') recDisabled = true;
          emitErr(code);
        }
      }
      if (state !== 'starting') { stopTracks(); return; } // cancelled meanwhile

      startLevel();
      startRecorder();
      state = 'recording';
      tStart = now();
      if (!recDisabled) startRec();
      if (recDisabled) markReady(); // no recognition: listening starts with the recorder
      else if (exclusiveTake) watchStart();
    } catch {
      if (state === 'starting') state = 'recording';
      tStart = tStart || now();
      markReady();
    }
  }

  // Exclusive take: recognition owns the mic, so its onstart is the only sign of life. Hint at an open
  // permission prompt, and give up on the take when nothing starts in time. The timer runs only once
  // permission is granted; while a prompt is open (or the state is unknown) the long timeout applies.
  function watchStart() {
    const live = () => !ready && state === 'recording' && !recDisabled;
    const arm = (ms) => {
      if (startTimer) clearTimeout(startTimer);
      startTimer = setTimeout(onStartTimeout, ms);
    };
    permStatus(PERM_QUERY_MS).then((st) => {
      try {
        if (!live()) return;
        const perm = st && st.state;
        if (perm === 'granted') arm(startTimeoutMs);
        else if (perm === 'prompt') {
          call(onPermission, 'prompt');
          permWatch = st;
          st.onchange = () => {
            try { if (live() && st.state === 'granted') { call(onPermission, 'granted'); arm(startTimeoutMs); } } catch { /* ignore */ }
          };
        } else if (perm !== 'denied') arm(promptTimeoutMs);
      } catch { /* ignore */ }
    });
  }

  function onStartTimeout() {
    startTimer = null;
    if (ready || state !== 'recording' || recDisabled) return;
    clearStartTimer();
    recDisabled = true;
    try { if (rec) rec.abort(); } catch { /* ignore */ }
    recActive = false;
    flushWaiters();
    emitErr('mic-timeout');
    doStop();
  }

  function waitRecEnd(ms) {
    if (!rec || !recActive) return Promise.resolve();
    return new Promise((resolve) => {
      const t = setTimeout(resolve, ms);
      endWaiters.push(() => { clearTimeout(t); resolve(); });
    });
  }

  function stopRecorder(ms) {
    return new Promise((resolve) => {
      if (!recorder || recorder.state === 'inactive') return resolve();
      const t = setTimeout(resolve, ms);
      recorder.onstop = () => { clearTimeout(t); resolve(); };
      try { recorder.stop(); } catch { clearTimeout(t); resolve(); }
    });
  }

  async function finishStop() {
    clearStartTimer();
    try {
      if (rec && recActive) { try { rec.stop(); } catch { /* ignore */ } }
      await Promise.all([waitRecEnd(1500), stopRecorder(1500)]);
      if (interim || runFinals.length) { committed.push(...runFinals); if (interim) committed.push(interim); runFinals = []; interim = ''; }
      if (!cancelled && recorder && chunks.length && typeof g.Blob === 'function' && g.URL && g.URL.createObjectURL) {
        const type = (recorder.mimeType) || mime || (chunks[0] && chunks[0].type) || 'audio/webm';
        audioUrl = g.URL.createObjectURL(new g.Blob(chunks, { type }));
      }
    } catch { /* fall through with what we have */ }
    chunks = [];
    recorder = null;
    stopTracks();
    unbindVisibility();
    state = 'done';
    if (cancelled) return EMPTY();
    const transcript = finalText();
    if (!transcript && sawNoSpeech && !recDisabled) emitErr('no-speech');
    return { transcript, durationSec: duration(), audioUrl };
  }

  function doStop() {
    if (cancelled) { state = 'done'; return Promise.resolve(EMPTY()); }
    if (stopPromise) return stopPromise;
    if (state === 'done' || state === 'idle') {
      state = 'done';
      unbindVisibility();
      stopTracks();
      return Promise.resolve(cancelled || !(t0 || tStart) ? EMPTY() : { transcript: finalText(), durationSec: duration(), audioUrl });
    }
    const wasStarting = state === 'starting';
    state = 'stopping';
    t1 = now();
    if (wasStarting) {
      // start() has not finished: release the mic wait and end with nothing.
      try { abortMic && abortMic(); } catch { /* ignore */ }
    }
    stopPromise = finishStop().catch(() => { state = 'done'; return EMPTY(); });
    return stopPromise;
  }

  function doDiscard() {
    if (audioUrl) { try { g.URL.revokeObjectURL(audioUrl); } catch { /* ignore */ } audioUrl = null; }
    chunks = [];
    stopTracks();
  }

  function doCancel() {
    const was = state;
    cancelled = true;
    state = 'done';
    clearStartTimer();
    try { abortMic && abortMic(); } catch { /* ignore */ }
    try { if (rec) { rec.onresult = null; rec.onend = null; rec.onerror = null; rec.onstart = null; rec.abort(); } } catch { /* ignore */ }
    recActive = false;
    try { if (recorder && recorder.state !== 'inactive') { recorder.ondataavailable = null; recorder.stop(); } } catch { /* ignore */ }
    recorder = null;
    chunks = [];
    committed = []; runFinals = []; interim = '';
    stopTracks();
    unbindVisibility();
    doDiscard();
    flushWaiters();
    return was;
  }

  return {
    start() { try { return doStart().catch(() => {}); } catch { return Promise.resolve(); } },
    stop() { try { return doStop(); } catch { state = 'done'; return Promise.resolve(EMPTY()); } },
    cancel() { try { return doCancel(); } catch { return 'done'; } },
    discard() { try { doDiscard(); } catch { /* never throw */ } },
  };
}
