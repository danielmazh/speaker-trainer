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
//   probeOnDevice(lang)   -> Promise<'yes'|'no'|'unknown'>  (support() returns the cached result)
//   installOnDevice(lang) -> Promise<boolean>  asks Chrome to download the local model (call from a tap)

const g = globalThis;

function getSR() {
  try { return g.SpeechRecognition || g.webkitSpeechRecognition || null; } catch { return null; }
}

const onDeviceCache = new Map(); // lang -> 'yes'|'no'|'unknown'

/** Ask Chrome whether local recognition is ready for `lang`. Never throws. */
export async function probeOnDevice(lang = 'en-US') {
  try {
    const SR = getSR();
    if (!SR) { onDeviceCache.set(lang, 'no'); return 'no'; }
    let status = null;
    if (typeof SR.available === 'function') {
      status = await withTimeout(SR.available({ langs: [lang], processLocally: true }), 3000);
    } else if (typeof SR.availableOnDevice === 'function') {
      // Older Chrome draft of the same API.
      status = await withTimeout(SR.availableOnDevice(lang), 3000);
    } else {
      onDeviceCache.set(lang, 'unknown');
      return 'unknown';
    }
    const res = status === 'available' ? 'yes' : status == null ? 'unknown' : 'no';
    onDeviceCache.set(lang, res);
    return res;
  } catch {
    onDeviceCache.set(lang, 'unknown');
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
    return false;
  }
}

/** Synchronous feature check. onDevice is 'unknown' until probeOnDevice() has finished once. */
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
    else if (typeof SR.available !== 'function' && typeof SR.availableOnDevice !== 'function') out.onDevice = 'unknown';
    else probeOnDevice(lang); // fill the cache for next time
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

/**
 * One practice take. onDevice: 'auto' (local when ready, else browser service),
 * 'on' (local only, never the cloud), 'off' (browser service).
 * start() never rejects; problems go to onError(code).
 */
export function createSession({
  lang = 'en-US', onDevice = 'auto', record = true,
  onInterim, onFinal, onLevel, onError,
} = {}) {
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

  const emitErr = (code) => { try { onError && onError(code); } catch { /* ignore UI errors */ } };
  const finalText = () => joinSegments([...committed, ...runFinals]);
  const runningText = () => joinSegments([...committed, ...runFinals, interim]);

  function stopTracks() {
    if (levelTimer) { clearInterval(levelTimer); levelTimer = null; }
    if (stream) { try { stream.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ } stream = null; }
    if (audioCtx) { try { audioCtx.close(); } catch { /* ignore */ } audioCtx = null; }
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
    if (!record || !stream || typeof g.MediaRecorder !== 'function') return;
    try {
      const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
      mime = (g.MediaRecorder.isTypeSupported && types.find((t) => g.MediaRecorder.isTypeSupported(t))) || '';
      recorder = mime ? new g.MediaRecorder(stream, { mimeType: mime }) : new g.MediaRecorder(stream);
      chunks = [];
      recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
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
      let inter = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        const txt = res[0] ? res[0].transcript : '';
        if (res.isFinal) {
          runFinals[i] = txt;
          try { onFinal && onFinal(finalText(), txt.trim()); } catch { /* ignore */ }
        } else {
          inter += txt;
        }
      }
      runFinals = runFinals.filter((x) => x !== undefined);
      interim = inter.trim();
      try { onInterim && onInterim(runningText()); } catch { /* ignore */ }
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

  async function chooseLocal() {
    if (onDevice === 'off') return { use: false, ok: true };
    const status = await probeOnDevice(lang);
    if (onDevice === 'on') {
      // Local only. Without a working local model we never send audio to the cloud.
      const probe = SR ? new SR() : null;
      const canSet = !!probe && ('processLocally' in probe || 'mode' in probe);
      return status === 'yes' && canSet ? { use: true, ok: true } : { use: false, ok: false };
    }
    return { use: status === 'yes', ok: true }; // auto
  }

  async function start() {
    if (state !== 'idle') return;
    state = 'starting';
    try {
      // Microphone (for level meter and recording).
      if (g.navigator && g.navigator.mediaDevices && g.navigator.mediaDevices.getUserMedia && (record || onLevel)) {
        try {
          stream = await g.navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          });
        } catch (e) {
          emitErr(mapMediaError(e));
          stream = null;
        }
      }
      if (state !== 'starting') { stopTracks(); return; } // cancelled meanwhile

      // Recognition.
      if (!SR) {
        recDisabled = true;
        emitErr('unsupported');
      } else {
        const c = await chooseLocal();
        if (!c.ok) { recDisabled = true; emitErr('ondevice-unavailable'); } else local = c.use;
      }
      if (state !== 'starting') { stopTracks(); return; }

      startLevel();
      startRecorder();
      t0 = now();
      state = 'recording';
      if (!recDisabled) startRec();
    } catch {
      state = state === 'starting' ? 'recording' : state;
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

  async function stop() {
    if (state === 'done') return { transcript: finalText(), durationSec: t0 ? Math.round((t1 - t0) / 100) / 10 : 0, audioUrl };
    if (state === 'idle') { state = 'done'; return { transcript: '', durationSec: 0, audioUrl: null }; }
    if (state === 'starting') { state = 'stopping'; }
    state = 'stopping';
    t1 = now();
    try {
      if (rec && recActive) { try { rec.stop(); } catch { /* ignore */ } }
      await Promise.all([waitRecEnd(1500), stopRecorder(1500)]);
      if (interim) { committed.push(...runFinals, interim); runFinals = []; interim = ''; }
      if (recorder && chunks.length) {
        const blob = new Blob(chunks, { type: mime || (chunks[0] && chunks[0].type) || 'audio/webm' });
        audioUrl = URL.createObjectURL(blob);
      }
    } catch { /* fall through with what we have */ }
    chunks = [];
    recorder = null;
    stopTracks();
    state = 'done';
    const transcript = finalText();
    if (!transcript && sawNoSpeech && !recDisabled) emitErr('no-speech');
    return { transcript, durationSec: t0 ? Math.max(0, Math.round((t1 - t0) / 100) / 10) : 0, audioUrl };
  }

  function cancel() {
    const was = state;
    state = 'done';
    try { if (rec) { rec.onresult = null; rec.onend = null; rec.onerror = null; rec.abort(); } } catch { /* ignore */ }
    try { if (recorder && recorder.state !== 'inactive') { recorder.ondataavailable = null; recorder.stop(); } } catch { /* ignore */ }
    recorder = null;
    chunks = [];
    committed = []; runFinals = []; interim = '';
    stopTracks();
    discard();
    const w = endWaiters; endWaiters = []; w.forEach((f) => f());
    return was;
  }

  function discard() {
    if (audioUrl) { try { URL.revokeObjectURL(audioUrl); } catch { /* ignore */ } audioUrl = null; }
    chunks = [];
    stopTracks();
  }

  return { start, stop, cancel, discard };
}
