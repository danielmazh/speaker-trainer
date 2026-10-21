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
const MIC_TIMEOUT_MS = 6000;

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

function mapRecError(code, local) {
  switch (code) {
    case 'not-allowed': return 'not-allowed';
    case 'service-not-allowed': return local ? 'ondevice-unavailable' : 'not-allowed';
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
// ("we are" then "we are going"). If a segment starts with the previous one, it replaces it.
function joinSegments(segs) {
  const out = [];
  for (const raw of segs) {
    const s = String(raw || '').trim();
    if (!s) continue;
    const prev = out[out.length - 1];
    if (prev && s.toLowerCase().startsWith(prev.toLowerCase())) out[out.length - 1] = s;
    else if (prev && prev.toLowerCase().endsWith(s.toLowerCase())) continue;
    else out.push(s);
  }
  return out.join(' ');
}

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
 * One practice take. onDevice: 'auto' (local when ready, else browser service),
 * 'on' (local only, never the cloud), 'off' (browser service).
 * No public method throws. start() never rejects; problems go to onError(code).
 * stop(), cancel() and discard() are idempotent and safe in any order, even before start() resolves.
 * The page going hidden while recording stops the take gracefully (Android cuts the mic in background).
 * micTimeoutMs / probeTimeoutMs are for tests.
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
  lang = 'en-US', onDevice = 'auto', record = true,
  onInterim, onFinal, onLevel, onError,
  micTimeoutMs = MIC_TIMEOUT_MS, probeTimeoutMs = PROBE_TIMEOUT_MS,
}) {
  const SR = getSR();
  let state = 'idle'; // idle | starting | recording | stopping | done
  let stream = null, audioCtx = null, levelTimer = null;
  let recorder = null, chunks = [], audioUrl = null, mime = '';
  let rec = null, local = false, recActive = false, recDisabled = false;
  let committed = []; // finals from earlier recognition runs
  let runFinals = []; // finals of the current run, by result index
  let interim = '';
  let t0 = 0, t1 = 0;
  let restarts = [];
  let sawNoSpeech = false;
  let endWaiters = [];
  let abortMic = null; // resolves a pending getUserMedia wait early
  let stopPromise = null;
  let cancelled = false;
  let visBound = false;

  const emitErr = (code) => { try { onError && onError(code); } catch { /* ignore UI errors */ } };
  const finalText = () => joinSegments([...committed, ...runFinals]);
  const runningText = () => joinSegments([...committed, ...runFinals, interim]);
  const duration = () => (t0 && t1 ? Math.max(0, Math.round((t1 - t0) / 100) / 10) : 0);

  function stopTracks() {
    if (levelTimer) { try { clearInterval(levelTimer); } catch { /* ignore */ } levelTimer = null; }
    if (stream) { killStream(stream); stream = null; }
    if (audioCtx) { try { const p = audioCtx.close(); if (p && p.catch) p.catch(() => {}); } catch { /* ignore */ } audioCtx = null; }
  }

  // Page visibility: when the page goes hidden mid-take, end it gracefully.
  function onVisibility() {
    try {
      const d = g.document;
      const hidden = d && (d.hidden === true || d.visibilityState === 'hidden');
      if (hidden && (state === 'recording' || state === 'starting')) doStop();
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
      const AC = g.AudioContext || g.webkitAudioContext;
      if (!AC) return;
      audioCtx = new AC();
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
      if (audioCtx.state === 'suspended' && audioCtx.resume) audioCtx.resume().catch(() => {});
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
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    if (local) {
      if ('processLocally' in r) r.processLocally = true;
      else if ('mode' in r) r.mode = 'ondevice-only'; // older Chrome draft
    }
    r.onresult = (ev) => {
      try {
        let inter = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const res = ev.results[i];
          const txt = res && res[0] ? res[0].transcript : '';
          if (res && res.isFinal) {
            runFinals[i] = txt;
            try { onFinal && onFinal(finalText(), String(txt || '').trim()); } catch { /* ignore */ }
          } else {
            inter += txt;
          }
        }
        runFinals = runFinals.filter((x) => x !== undefined);
        interim = inter.trim();
        try { onInterim && onInterim(runningText()); } catch { /* ignore */ }
      } catch { /* ignore malformed events */ }
    };
    r.onerror = (ev) => {
      const code = ev && ev.error;
      if (code === 'no-speech') { sawNoSpeech = true; return; } // Android: restart quietly
      if (code === 'aborted') return; // our own stop, or Android ending early: onend restarts
      if (FATAL.has(code)) recDisabled = true;
      emitErr(mapRecError(code, local));
    };
    r.onend = () => {
      recActive = false;
      // Keep finals of this run; drop the run-local index space.
      committed.push(...runFinals);
      if (interim && state !== 'recording') committed.push(interim); // last words before stop
      runFinals = [];
      interim = '';
      if (state === 'recording' && !recDisabled) {
        const t = now();
        restarts = restarts.filter((x) => t - x < 5000);
        restarts.push(t);
        if (restarts.length > 8) { recDisabled = true; emitErr('aborted'); return; }
        setTimeout(() => { if (state === 'recording' && !recDisabled) startRec(); }, restarts.length > 3 ? 400 : 50);
        return;
      }
      const w = endWaiters; endWaiters = []; w.forEach((f) => f());
    };
    return r;
  }

  function startRec() {
    try {
      rec = newRecognition();
      rec.start();
      recActive = true;
    } catch {
      recActive = false;
    }
  }

  // Resolves { stream } | { error } | { timeout } | { aborted }. A stream that arrives
  // after we gave up is stopped at once, so the mic is never left on.
  function getMic() {
    return new Promise((resolve) => {
      let settled = false, timer = null;
      const finish = (v) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        abortMic = null;
        resolve(v);
      };
      timer = setTimeout(() => finish({ timeout: true }), micTimeoutMs);
      abortMic = () => finish({ aborted: true });
      let p;
      try {
        p = g.navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      } catch (e) { finish({ error: e }); return; }
      Promise.resolve(p).then(
        (s) => { if (settled) killStream(s); else finish({ stream: s }); },
        (e) => finish({ error: e }),
      );
    });
  }

  async function chooseLocal() {
    if (onDevice === 'off') return { use: false, ok: true };
    let status = cachedOnDevice(lang);
    if (status == null) status = await probeOnDevice(lang, { timeoutMs: probeTimeoutMs });
    if (onDevice === 'on') {
      // Local only. Without a working local model we never send audio to the cloud.
      let canSet = false;
      try { const probe = new SR(); canSet = 'processLocally' in probe || 'mode' in probe; } catch { canSet = false; }
      return status === 'yes' && canSet ? { use: true, ok: true } : { use: false, ok: false };
    }
    return { use: status === 'yes', ok: true }; // auto: 'no' or 'unknown' means the browser service
  }

  async function doStart() {
    if (state !== 'idle') return;
    state = 'starting';
    bindVisibility();
    try {
      // Microphone (for level meter and recording).
      const md = g.navigator && g.navigator.mediaDevices;
      if (md && typeof md.getUserMedia === 'function' && (record || onLevel)) {
        const r = await getMic();
        if (r.stream) {
          if (state !== 'starting') { killStream(r.stream); return; } // stopped or cancelled meanwhile
          stream = r.stream;
        } else if (r.timeout) {
          // getUserMedia hung (seen in headless Chrome). Give up on this take.
          stopTracks();
          state = 'done';
          unbindVisibility();
          emitErr('audio-capture');
          return;
        } else if (r.aborted) {
          return;
        } else if (r.error) {
          if (state !== 'starting') return;
          emitErr(mapMediaError(r.error));
        }
      }
      if (state !== 'starting') { stopTracks(); return; } // cancelled meanwhile

      // Recognition.
      if (!SR) {
        recDisabled = true;
        emitErr('unsupported');
      } else {
        const c = await chooseLocal();
        if (state !== 'starting') { stopTracks(); return; }
        if (!c.ok) { recDisabled = true; emitErr('ondevice-unavailable'); } else local = c.use;
      }
      if (state !== 'starting') { stopTracks(); return; }

      startLevel();
      startRecorder();
      t0 = now();
      state = 'recording';
      if (!recDisabled) startRec();
    } catch {
      if (state === 'starting') state = 'recording';
      t0 = t0 || now();
    }
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
    try {
      if (rec && recActive) { try { rec.stop(); } catch { /* ignore */ } }
      await Promise.all([waitRecEnd(1500), stopRecorder(1500)]);
      if (interim) { committed.push(...runFinals, interim); runFinals = []; interim = ''; }
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
      return Promise.resolve(cancelled || !t0 ? EMPTY() : { transcript: finalText(), durationSec: duration(), audioUrl });
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
    try { abortMic && abortMic(); } catch { /* ignore */ }
    try { if (rec) { rec.onresult = null; rec.onend = null; rec.onerror = null; rec.abort(); } } catch { /* ignore */ }
    recActive = false;
    try { if (recorder && recorder.state !== 'inactive') { recorder.ondataavailable = null; recorder.stop(); } } catch { /* ignore */ }
    recorder = null;
    chunks = [];
    committed = []; runFinals = []; interim = '';
    stopTracks();
    unbindVisibility();
    doDiscard();
    const w = endWaiters; endWaiters = []; w.forEach((f) => { try { f(); } catch { /* ignore */ } });
    return was;
  }

  return {
    start() { try { return doStart().catch(() => {}); } catch { return Promise.resolve(); } },
    stop() { try { return doStop(); } catch { state = 'done'; return Promise.resolve(EMPTY()); } },
    cancel() { try { return doCancel(); } catch { return 'done'; } },
    discard() { try { doDiscard(); } catch { /* never throw */ } },
  };
}
