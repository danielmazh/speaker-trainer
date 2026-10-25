// Mic panel: one spoken take. Live transcript, level ring, optional countdown,
// and full fallbacks (record and listen + self-rating, or type what you said).
// States: idle, starting (tap seen, mic or recognition not ready yet), listening, processing, done, off.
//
// Mic ownership: on mobile (Android, iOS) a take with speech recognition never opens getUserMedia,
// so recognition alone owns the mic. The level ring is then driven by recognition events.
// Recording for playback is a separate take there: the "הקלט לשמיעה" button (no live transcript).
// On desktop one take records and recognizes together.
//
// Errors are per take, with a retry. Only 'not-allowed' (permission denied) on the first start of a take
// is kept for the session (ctx.session.micIssue). The no-mic note shows once per session, then a small
// chip; never both at once.
//
// iOS: recognition is not restarted outside a user tap. When it ends on its own the take keeps what was
// heard and the panel pauses: "המשך לדבר" starts a new take appended to the same answer, "סיים" submits.
//
// Typing: while the typed box is open the block gets class 'typing' (also on the panel), the note and
// the mic row are hidden, and only a compact text box with send shows.
import { esc, fmtTime } from './dom.js';
import { icon } from './icons.js';

const ERR_HE = {
  'not-allowed': 'אין גישה למיקרופון. אפשר לאשר בהגדרות האתר בדפדפן ולנסות שוב. בינתיים אפשר להקליד או לדרג את עצמך.',
  'audio-capture': 'המיקרופון לא נפתח בפעם הזו. נסה שוב, או הקלד את התשובה.',
  'mic-timeout': 'המיקרופון לא נפתח בזמן. נסה שוב, או הקלד את התשובה.',
  unsupported: 'הדפדפן הזה לא ממיר דיבור לטקסט. אני מקליט, אתה מקשיב ומדרג את עצמך. או מקליד את התשובה.',
  'ondevice-unavailable': 'זיהוי על המכשיר לא זמין, ובחרת לא להשתמש בשירות של הדפדפן. אפשר לשנות בפרופיל, להקליד או לדרג את עצמך.',
  network: 'שירות הדיבור של הדפדפן לא זמין כרגע (אולי אין רשת). נסה שוב, או הקלד את התשובה.',
  'no-speech': 'לא שמעתי מילים. נסה שוב, קרוב יותר למיקרופון.',
  'rec-failed': 'זיהוי הדיבור נעצר ולא הצליח להתחיל מחדש. נסה שוב, או הקלד את התשובה.',
  aborted: 'זיהוי הדיבור נעצר ולא הצליח להתחיל מחדש. נסה שוב, או הקלד את התשובה.',
  'dictation-off': 'זיהוי הדיבור כבוי באייפון. הפעל הכתבה (הגדרות > כללי > מקלדת > הפעל הכתבה) ואם צריך גם את Siri, או הקלד את התשובה.',
  'service-off': 'שירות הדיבור של הדפדפן חסום. אפשר להקליד את התשובה או לדרג את עצמך.',
};
const CHIP_HE = { unsupported: 'בלי זיהוי דיבור', 'not-allowed': 'אין גישה למיקרופון' };
// Only a denied permission is kept for the session. Everything else is per take.
const STICKY = new Set(['not-allowed']);
// Errors that end a take at once when no recorder runs beside recognition (mobile, or no mic stream).
const ENDS_TAKE = new Set(['not-allowed', 'audio-capture', 'mic-timeout']);
const MIC_PX = 88; // compact block: the mic fits a sticky bottom dock (about 180px with status and actions)

/**
 * What to do with an error code in a take. Pure, for tests.
 * takeKind: 'both' (desktop: record + recognize), 'rec-only' (mobile recognition), 'record' (no transcript).
 * -> { sticky: keep for the session, show: show now, endsTake: stop the take now, message }
 */
export function errorPolicy(code, takeKind = 'both') {
  const quiet = code === 'unsupported' || code === 'no-speech';
  return {
    sticky: STICKY.has(code),
    show: !quiet && !!ERR_HE[code],
    endsTake: !quiet && (ENDS_TAKE.has(code) || takeKind === 'rec-only' || takeKind === 'record'),
    message: ERR_HE[code] || '',
  };
}

/** The no-mic note: 'full' the first time in a session, then 'chip'. Marks it as shown. */
export function noticeMode(session, code) {
  if (!code) return null;
  const notes = session.micNotes || (session.micNotes = {});
  const mode = notes[code] ? 'chip' : 'full';
  notes[code] = true;
  return mode;
}

function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// Layout for the compact mic block. Injected once, so the block works in any host (sticky dock or not).
const BLOCK_CSS = `
.mic-block{display:flex;flex-direction:column;gap:4px;padding:4px 0 calc(4px + env(safe-area-inset-bottom,0px))}
.mic-row{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px}
.mic-block .mic-area{padding:0;gap:0}
.mic-side{justify-self:center;display:flex;flex-direction:column;align-items:center;gap:2px;min-width:72px;min-height:48px;padding:4px 6px;border:0;border-radius:12px;background:none;color:var(--primary);font:inherit;font-size:.75rem;font-weight:600;line-height:1.2;cursor:pointer}
.mic-side svg{width:22px;height:22px}
.mic-side:disabled{opacity:.4;cursor:default}
.mic-block .mic-core svg{width:28px;height:28px}
.mic-block .mic-core .i-stop{width:22px;height:22px;border-radius:6px}
.mic-status{min-height:20px;display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:2px 8px;text-align:center;font-size:.8125rem;line-height:1.35}
.mic-status .mic-hint{font-size:inherit}
.mic-err{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:2px 8px;color:var(--warn-ink)}
.mic-err[hidden]{display:none}
.mic-err svg{width:16px;height:16px;flex:0 0 16px}
.mic-err .mic-err-t{max-width:34ch}
.mic-retry{font-weight:700}
.mic-chip{display:inline-flex;align-items:center;gap:4px;min-height:44px;padding:2px 10px;border:0;border-radius:999px;background:var(--warn-50);color:var(--warn-ink);font:inherit;font-size:.75rem;cursor:pointer}
.mic-chip svg{width:14px;height:14px}
.mic-panel.compact .transcript-card{padding:8px 12px;gap:4px}
.mic-panel.compact .transcript{max-height:calc(2 * 2em);font-size:1rem}
.mic-panel.compact .transcript-card[hidden]{display:none}
.mic[data-state="starting"] .halo{opacity:0}
.mic[data-state="starting"] .i-mic{display:none}
.mic[data-state="starting"] .i-load{display:grid;animation:spinFull 1s linear infinite}
.mic[data-state="starting"] .lvl-ring{opacity:1;animation:spin 1s linear infinite}
.mic[data-state="starting"] .lvl-arc{stroke-dasharray:98 400 !important}
`;
function injectCss() {
  try {
    if (typeof document === 'undefined' || document.getElementById('mic-block-css')) return;
    const st = document.createElement('style');
    st.id = 'mic-block-css';
    st.textContent = BLOCK_CSS;
    document.head.appendChild(st);
  } catch { /* layout only */ }
}

// Transcript as HTML: fillers, be-drops and "he" marked by analyze.highlight; must phrases marked green.
export function segHtml(A, text, must = []) {
  if (!text) return '';
  const mustRe = must.length ? new RegExp(`\\b(${must.map((m) => escRe(m).replace(/\s+/g, '\\s+')).join('|')})\\b`, 'gi') : null;
  return A.highlight(text).map((s) => {
    if (s.kind === 'word') {
      if (!mustRe) return esc(s.text);
      let out = '', last = 0;
      s.text.replace(mustRe, (m, _g, off) => { out += esc(s.text.slice(last, off)) + `<mark class="hl-must">${esc(m)}</mark>`; last = off + m.length; return m; });
      return out + esc(s.text.slice(last));
    }
    const title = s.kind === 'filler' ? 'filler' : s.kind === 'bedrop' ? 'missing is/are' : 'it, not he';
    return `<mark class="hl-${s.kind}" title="${title}">${esc(s.text)}</mark>`;
  }).join('');
}

export function diffHtml(diff, max = 0) {
  if (!diff || !diff.length) return '';
  let list = diff, more = 0;
  if (max && diff.length > max) {
    // Keep what was said plus a few missing words after it.
    let lastOk = -1;
    diff.forEach((d, i) => { if (d.status !== 'miss') lastOk = i; });
    const cut = Math.max(max, Math.min(diff.length, lastOk + 6));
    list = diff.slice(0, cut);
    more = diff.slice(cut).filter((d) => d.status === 'miss').length;
  }
  return `<p class="diff en" dir="ltr" lang="en">${list.map((d) => `<span class="d-${d.status}">${esc(d.w)}</span>`).join(' ')}${more ? ` <span class="d-more">ועוד ${more}</span>` : ''}</p>
    <div class="diff-key tiny"><span class="d-ok">נאמר</span><span class="d-miss">חסר</span><span class="d-extra">נוסף</span></div>`;
}

export function starsHtml(id = 'stars') {
  return `<div class="stars" id="${id}" data-testid="stars" role="radiogroup" aria-label="דרג את עצמך מ-1 עד 5">
    ${[1, 2, 3, 4, 5].map((n) => `<button role="radio" aria-checked="false" data-star="${n}" aria-label="${n} מתוך 5">${icon('star')}</button>`).join('')}
  </div>`;
}

export function bindStars(root, onRate) {
  const box = root.querySelector('.stars');
  if (!box) return;
  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-star]');
    if (!b) return;
    const n = Number(b.dataset.star);
    box.querySelectorAll('[data-star]').forEach((x) => {
      x.classList.toggle('on', Number(x.dataset.star) <= n);
      x.setAttribute('aria-checked', String(Number(x.dataset.star) === n));
    });
    setTimeout(() => onRate(n), 350);
  });
}

/**
 * micPanel(host, ctx, opts)
 * opts: { target, must, banned, analyze (options for A.analyze, overrides target/must/banned), seconds,
 *         live=true, size (capped at 88), label, between (html between transcript and mic), noSelf,
 *         onLive(analysis, text, elapsed), onTick(secondsLeftOrElapsed), onStart() (at the tap),
 *         onReady() (listening really started), onDone(take),
 *         onEnd({ done, reason }) (the take is over and the mic is idle again: after every empty or failed
 *         take, and after onDone. Not while an iOS answer is paused. onStop is an alias) }
 * take: { mode:'speech'|'record'|'typed'|'self', transcript, durationSec, audioUrl, analysis, selfScore }
 * Returns { start, stop, recording (true while a take runs or an answer is paused), paused, typing,
 *           onEnd(fn) (add a listener), el (the compact mic block, one element to pin in a sticky dock), panel }.
 */
export function micPanel(host, ctx, opts = {}) {
  const { S, A } = ctx;
  // 2026-10-25: block styles live in css/play.css; injectCss() kept unused for hosts without it.
  const sup = S.support();
  const plat = (typeof S.platform === 'function' && S.platform()) || { mobile: false };
  const session = ctx.session || (ctx.session = {});
  const issue = STICKY.has(session.micIssue) ? session.micIssue : null;
  const canRecord = sup.recorder;
  const canRec = sup.recognition && !issue;
  // Mobile with recognition: recognition-only takes; recording for playback is its own take.
  const mobileRec = !!plat.mobile && sup.recognition;
  const live = opts.live !== false;
  const seconds = Number(opts.seconds) || 0;
  const size = Math.min(Number(opts.size) || MIC_PX, MIC_PX);
  const must = opts.must || [];
  const aOpts = opts.analyze || { target: opts.target, must, banned: opts.banned };
  const anal = (text, dur) => A.analyze(text, dur, aOpts);

  let sess = null, t0 = 0, timer = null, finished = false, state = 'idle', lastErr = null, lastText = '';
  let takeKind = 'both'; // 'both' (desktop: record + recognize), 'rec-only' (mobile), 'record' (no transcript)
  let pulseTimer = null;
  let carry = null; // iOS: { text, dur } heard in earlier takes of this answer, while paused
  let typing = false;
  const endFns = [];
  if (typeof (opts.onEnd || opts.onStop) === 'function') endFns.push(opts.onEnd || opts.onStop);
  const pulse = { speaking: false, sound: false, bump: 0, ph: 0 };

  const noteCode = !sup.recognition ? 'unsupported' : issue;
  const noteFull = noticeMode(session, noteCode) === 'full';
  const noMicAtAll = !canRecord && !sup.recognition;
  const R = 62, C = 2 * Math.PI * R;
  const selfLabel = mobileRec ? 'הקלט לשמיעה' : 'דרג';
  const selfAria = mobileRec ? 'הקלט לשמיעה, בלי תמלול' : 'דרג את עצמך';

  host.innerHTML = `<div class="mic-panel compact" data-testid="mic-panel">
    ${noteCode ? `<div class="note warn mic-note" data-note ${noteFull ? '' : 'hidden'}>${icon('micOff')}<span>${esc(ERR_HE[noteCode])}</span></div>` : ''}
    ${live && canRec ? `<div class="card transcript-card">
      <div class="card-head"><span class="tiny muted bold">התמלול שלך</span><span class="live" hidden><i></i>בשידור</span></div>
      <p class="transcript en" dir="ltr" lang="en" aria-live="polite" data-testid="transcript"><span class="ph" dir="rtl" lang="he">המילים שלך יופיעו כאן</span></p>
    </div>` : ''}
    ${opts.between || ''}
    <div class="mic-after" hidden></div>
    <div class="mic-block" data-testid="mic-block">
      <div class="mic-typed" hidden></div>
      <div class="mic-row">
        <button class="mic-side" data-type data-testid="mic-type" aria-label="הקלד את התשובה">${icon('keyboard')}<span>הקלד</span></button>
        <div class="mic-area">
          <div class="mic ${noMicAtAll ? 'off' : ''}" data-state="${noMicAtAll ? 'off' : 'idle'}" style="--size:${size}px">
            <span class="halo h1"></span><span class="halo h2"></span>
            <svg class="lvl-ring" viewBox="0 0 140 140" aria-hidden="true">
              <circle cx="70" cy="70" r="${R}" class="lvl-track"/>
              <circle cx="70" cy="70" r="${R}" class="lvl-arc" stroke-dasharray="0 ${C.toFixed(1)}"/>
            </svg>
            <button class="mic-core" data-testid="mic" aria-pressed="false" aria-label="${esc(opts.label || 'התחל להקליט')}" ${noMicAtAll ? 'disabled' : ''}>
              <span class="i-mic">${icon(noMicAtAll ? 'micOff' : 'mic')}</span><span class="i-stop"></span><span class="i-load">${icon('loader')}</span>
            </button>
          </div>
        </div>
        ${opts.noSelf ? '<span></span>' : `<button class="mic-side" data-self data-testid="mic-self" aria-label="${selfAria}">${icon(mobileRec ? 'headphones' : 'starLine')}<span>${selfLabel}</span></button>`}
      </div>
      <div class="mic-status" aria-live="polite">
        ${noteCode ? `<button class="mic-chip" data-chip aria-expanded="false" style="min-height:44px" ${noteFull ? 'hidden' : ''}>${icon('micOff')}<span>${esc(CHIP_HE[noteCode])}</span></button>` : ''}
        <div class="mic-hint">${noMicAtAll ? 'אין מיקרופון בדפדפן הזה' : 'הקש ודבר'}<span class="mic-sep" hidden> · </span><bdi class="mic-time"></bdi></div>
        <div class="mic-pause" hidden><button class="mic-chip mic-cont" data-cont data-testid="mic-continue" style="min-height:44px">${icon('mic')}<span>המשך לדבר</span></button><button class="link-btn mic-finish" data-finish data-testid="mic-finish" style="min-height:44px">${icon('check')} סיים</button></div>
        <div class="mic-err" hidden>${icon('circleAlert')}<span class="mic-err-t"></span><button class="link-btn mic-retry" data-retry hidden>${icon('refresh')} נסה שוב</button></div>
      </div>
    </div>
  </div>`;

  const q = (s) => host.querySelector(s);
  const panel = q('.mic-panel');
  const block = q('.mic-block');
  const mic = q('.mic');
  const btn = q('.mic-core');
  const arc = q('.lvl-arc');
  const tx = q('.transcript');
  const liveTag = q('.live');
  const hint = q('.mic-hint');
  const timeEl = q('.mic-time');
  const errBox = q('.mic-err');
  const errText = q('.mic-err-t');
  const retryBtn = q('[data-retry]');
  const after = q('.mic-after');
  const typeBtn = q('[data-type]');
  const selfBtn = q('[data-self]');
  const note = q('.mic-note');
  const chip = q('[data-chip]');
  const row = q('.mic-row');
  const status = q('.mic-status');
  const typedBox = q('.mic-typed');
  const pauseBox = q('.mic-pause');
  const sep = q('.mic-sep');
  const card = q('.transcript-card');

  const setState = (s) => { state = s; mic.dataset.state = s; };
  const setHint = (t) => { hint.firstChild.textContent = t; };
  const setTime = (t) => { timeEl.textContent = t || ''; sep.hidden = !t; };
  const emitEnd = (info) => { endFns.slice().forEach((f) => { try { f(info); } catch (e) { console.error(e); } }); };
  // Words from paused earlier takes plus this take. iOS gives separate runs, so a plain join is right.
  const withCarry = (t) => [carry && carry.text, t].filter(Boolean).join(' ').trim();

  function showErr(code, { retry = false } = {}) {
    const msg = ERR_HE[code];
    if (!msg) return;
    errBox.hidden = false;
    errText.textContent = msg;
    retryBtn.hidden = !retry;
  }
  function clearErr() { errBox.hidden = true; retryBtn.hidden = true; }

  function setLevel(l) {
    const v = Math.min(1, l * 1.5);
    arc.setAttribute('stroke-dasharray', `${(C * v).toFixed(1)} ${C.toFixed(1)}`);
    mic.style.setProperty('--lvl', v.toFixed(2));
  }

  // Mobile: no mic stream, so the ring follows recognition events with a light animation.
  function onActivity(kind) {
    if (kind === 'sound') pulse.sound = true;
    else if (kind === 'speech') { pulse.speaking = true; pulse.sound = true; }
    else if (kind === 'result') { pulse.speaking = true; pulse.bump = 1; }
    else if (kind === 'speechend') pulse.speaking = false;
    else if (kind === 'soundend') { pulse.sound = false; pulse.speaking = false; }
  }
  function startPulse() {
    stopPulse();
    pulseTimer = setInterval(() => {
      pulse.ph += 0.35;
      const base = pulse.speaking ? 0.3 + Math.random() * 0.3 : pulse.sound ? 0.12 + Math.random() * 0.08 : 0.05 + 0.03 * Math.sin(pulse.ph);
      pulse.bump *= 0.75;
      setLevel(Math.max(base, pulse.bump * 0.6));
    }, 90);
  }
  function stopPulse() { if (pulseTimer) { clearInterval(pulseTimer); pulseTimer = null; } }

  function tick() {
    const el = (performance.now() - t0) / 1000;
    if (seconds) {
      const left = Math.max(0, seconds - el);
      opts.onTick ? opts.onTick(Math.ceil(left)) : setTime(fmtTime(Math.ceil(left)));
      if (left <= 10) mic.classList.add('ending');
      if (left <= 0) { ctx.sound('tap'); ctx.haptic([30, 40, 30]); stop({ timeUp: true }); }
    } else {
      opts.onTick ? opts.onTick(Math.floor(el)) : setTime(fmtTime(el));
    }
  }

  function onText(raw) {
    lastText = raw;
    const text = withCarry(raw);
    if (tx && takeKind !== 'record') {
      tx.innerHTML = (segHtml(A, text, must) || '') + '<span class="caret" aria-hidden="true"></span>';
      tx.scrollTop = tx.scrollHeight;
    }
    if (opts.onLive && t0) {
      const el = (performance.now() - t0) / 1000;
      try { opts.onLive(anal(text, el), text, el); } catch (e) { console.error(e); }
    }
  }

  // Listening really starts here (recognition onstart, or the recorder when there is no recognition).
  // The countdown starts now, not at the tap, so first words and seconds are not lost.
  function onReady() {
    if (state !== 'starting') return;
    setState('listening');
    setHint(takeKind === 'record' ? 'מקליט... הקש כדי לסיים' : 'מקשיב... הקש כדי לסיים');
    if (liveTag && takeKind !== 'record') liveTag.hidden = false;
    ctx.haptic(15);
    // A continued (iOS) answer keeps counting from the time already used.
    t0 = performance.now() - (carry ? carry.dur * 1000 : 0);
    timer = setInterval(tick, 250);
    tick();
    if (takeKind === 'rec-only') startPulse();
    try { opts.onReady && opts.onReady(); } catch (e) { console.error(e); }
  }

  function onPermission(s) {
    if (state !== 'starting') return;
    setHint(s === 'prompt' ? 'אשר גישה למיקרופון' : 'רגע...');
  }

  function onError(code) {
    lastErr = code;
    const p = errorPolicy(code, takeKind);
    // Sticky only for a denied first start. A refused restart or a continued answer means the mic works.
    if (p.sticky && state === 'starting' && !carry) session.micIssue = code;
    if (p.show) showErr(code); // 'unsupported' has the note, 'no-speech' is shown by stop()
    // Without a recorder beside recognition there is nothing left to do in this take.
    if (p.endsTake && (state === 'listening' || state === 'starting')) stop();
  }

  // Page listeners live for one take only, so they never pile up across takes or items.
  let hideBound = false;
  function bindHide() {
    if (hideBound) return;
    hideBound = true;
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
  }
  function unbindHide() {
    if (!hideBound) return;
    hideBound = false;
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', onHide);
  }

  function showPause(on) {
    pauseBox.hidden = !on;
    btn.setAttribute('aria-label', on ? 'המשך לדבר' : 'הקלט שוב');
  }

  function start(kind) {
    if (finished || state !== 'idle' || noMicAtAll) return Promise.resolve();
    if (typing) exitTyping();
    takeKind = kind === 'record' ? 'record' : mobileRec ? 'rec-only' : 'both';
    if (takeKind === 'record' && carry) { carry = null; showPause(false); } // a recording replaces a paused answer
    // AudioContext inside the tap (iOS and Safari keep it suspended otherwise). Only for takes with a
    // mic stream: a mobile recognition-only take has no stream to measure.
    let ac = null;
    if (takeKind !== 'rec-only') {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) { ac = new AC(); const p = ac.resume && ac.resume(); if (p && p.catch) p.catch(() => {}); }
      } catch { ac = null; }
    }
    setState('starting');
    lastErr = null;
    lastText = '';
    t0 = 0;
    clearErr();
    after.hidden = true;
    pauseBox.hidden = true;
    bindHide();
    btn.setAttribute('aria-pressed', 'true');
    btn.setAttribute('aria-label', 'עצור');
    if (selfBtn) {
      selfBtn.disabled = takeKind !== 'record';
      if (takeKind === 'record') selfBtn.querySelector('span').textContent = 'עצור';
    }
    setHint('רגע...');
    if (tx && takeKind !== 'record') tx.innerHTML = (carry ? segHtml(A, carry.text, must) + ' ' : '') + '<span class="caret" aria-hidden="true"></span>';
    sess = S.createSession({
      lang: 'en-US',
      onDevice: (ctx.state && ctx.state.settings && ctx.state.settings.onDevice) || 'auto',
      record: takeKind !== 'rec-only',
      recognize: takeKind !== 'record',
      exclusiveMic: takeKind === 'rec-only',
      audioCtx: ac,
      onInterim: onText,
      onFinal: (full) => onText(full),
      onLevel: takeKind === 'rec-only' ? undefined : setLevel,
      onActivity: takeKind === 'rec-only' ? onActivity : undefined,
      onReady,
      onPermission,
      onError,
      onEnded: () => { if (state === 'listening' || state === 'starting') stop({ auto: true }); },
    });
    try { opts.onStart && opts.onStart(); } catch (e) { console.error(e); }
    return sess.start();
  }

  async function stop({ auto = false, timeUp = false } = {}) {
    if (state !== 'listening' && state !== 'starting') return;
    const wasReady = state === 'listening';
    setState('processing');
    clearInterval(timer); timer = null;
    stopPulse();
    mic.classList.remove('ending');
    setLevel(0);
    btn.disabled = true;
    if (liveTag) liveTag.hidden = true;
    setHint('רגע, מסכם...');
    let res = {};
    try { res = (await sess.stop()) || {}; } catch { res = {}; }
    unbindHide();
    if (finished) return; // left meanwhile
    const kind = takeKind;
    btn.disabled = false;
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('aria-label', 'הקלט שוב');
    if (selfBtn) { selfBtn.disabled = false; selfBtn.querySelector('span').textContent = selfLabel; }
    setState('idle');
    setHint('הקש כדי לנסות שוב');
    setTime('');
    if (res.audioUrl) (session.urls = session.urls || []).push(res.audioUrl);
    const now = kind === 'record' ? '' : (res.transcript || lastText || '').trim();
    const dur = (carry ? carry.dur : 0) + (Number(res.durationSec) || 0);
    if (now && session.micIssue) session.micIssue = null; // the mic works again
    // iOS: the recognizer ended on its own (or a continued take brought nothing new). Keep the answer
    // open: "המשך לדבר" appends a new take, "סיים" submits what was heard.
    if (kind === 'rec-only' && !timeUp && ((auto && now) || (carry && !now))) {
      carry = { text: withCarry(now), dur };
      if (tx) tx.innerHTML = segHtml(A, carry.text, must);
      setHint('נעצר בהפסקה.');
      if (lastErr && ERR_HE[lastErr] && !now) showErr(lastErr);
      showPause(true);
      return;
    }
    const transcript = withCarry(now);
    if (transcript) {
      if (tx) tx.innerHTML = segHtml(A, transcript, must);
      done({ mode: 'speech', transcript, durationSec: dur, audioUrl: res.audioUrl, analysis: anal(transcript, dur) });
      return;
    }
    if (tx) tx.innerHTML = '<span class="ph">...</span>';
    if (res.audioUrl) {
      // A recording without words: listen, then rate (or type).
      fallback(res.audioUrl, res.durationSec);
      emitEnd({ done: false, reason: 'record' });
      return;
    }
    // Nothing usable from this take: say why, offer a retry. Type and rate stay in the row.
    if (lastErr && ERR_HE[lastErr] && lastErr !== 'unsupported') showErr(lastErr, { retry: true });
    else if (wasReady && kind !== 'record') showErr('no-speech', { retry: true });
    emitEnd({ done: false, reason: lastErr || (wasReady ? 'no-speech' : 'cancelled') });
  }

  // iOS paused answer: submit what was heard.
  function finishCarry() {
    if (!carry || state !== 'idle' || finished) return;
    const { text, dur } = carry;
    showPause(false);
    done({ mode: 'speech', transcript: text, durationSec: dur, audioUrl: null, analysis: anal(text, dur) });
  }

  function fallback(audioUrl, durationSec) {
    after.hidden = false;
    after.innerHTML = `<div class="card stack-sm fallback">
      ${audioUrl ? `<button class="btn ghost sm" data-listen>${icon('headphones')} הקשב להקלטה שלך</button>` : ''}
      <p class="small">${audioUrl ? 'הקשב, ואז דרג: כמה זה היה קרוב?' : 'כמה זה היה קרוב, לדעתך?'}</p>
      ${starsHtml()}
      <button class="link-btn" data-type2>${icon('keyboard')} או הקלד את התשובה</button>
    </div>`;
    let audio = null;
    after.querySelector('[data-listen]')?.addEventListener('click', (e) => {
      const b = e.currentTarget;
      const idle = () => { b.innerHTML = `${icon('headphones')} הקשב שוב`; };
      if (!audio) { audio = new Audio(audioUrl); audio.onended = idle; ctx.onLeave(() => audio.pause()); }
      if (audio.paused) { audio.currentTime = 0; audio.play().catch(idle); b.innerHTML = `${icon('pause')} עצור`; }
      else { audio.pause(); idle(); }
    });
    bindStars(after, (n) => done({ mode: audioUrl ? 'record' : 'self', transcript: '', durationSec, audioUrl, analysis: null, selfScore: n * 20 }));
    after.querySelector('[data-type2]').addEventListener('click', () => typed(durationSec, audioUrl));
    after.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  // Typing mode: only a compact text box with send in the block. The note, the transcript card and the
  // mic row are hidden, so the dock stays small. Class 'typing' lets the page CSS unpin the dock.
  let typingPrev = null;
  function typed(durationSec = 0, audioUrl = null) {
    if (state === 'listening' || state === 'starting') { stop(); return; }
    if (finished) return;
    if (!typing) {
      typing = true;
      typingPrev = { note: note ? note.hidden : true, chip: chip ? chip.hidden : true, after: after.hidden, card: card ? card.hidden : true };
      block.classList.add('typing');
      panel.classList.add('typing');
      if (note) note.hidden = true;
      if (card) card.hidden = true;
      after.hidden = true;
      row.hidden = true;
      status.hidden = true;
    }
    const back = noMicAtAll ? 'חזרה' : 'חזרה למיקרופון';
    typedBox.hidden = false;
    typedBox.innerHTML = `<div class="card stack-sm mic-typed-card">
      <textarea data-testid="typed" class="textarea en" dir="ltr" lang="en" aria-label="הקלד את התשובה באנגלית" placeholder="Type your answer in English" autocomplete="off" autocapitalize="sentences" spellcheck="false" rows="2"></textarea>
      <div class="spread"><button class="link-btn" data-typed-back data-testid="typed-back" style="min-height:44px">${icon('mic')} ${back}</button>
      <button class="btn sm" data-check data-testid="typed-check">${icon('check')} בדוק</button></div>
    </div>`;
    const ta = typedBox.querySelector('textarea');
    if (carry && carry.text) ta.value = carry.text; // iOS paused answer: edit what was heard
    try { ta.focus({ preventScroll: true }); } catch { ta.focus(); }
    try { ta.scrollIntoView({ block: 'end' }); } catch { /* layout only */ }
    typedBox.querySelector('[data-check]').addEventListener('click', () => {
      const t = ta.value.trim();
      if (!t) { ta.focus(); return; }
      const words = A.tokenize(t).length;
      const dur = durationSec || (carry && carry.dur) || Math.max(5, (words / 130) * 60);
      done({ mode: 'typed', transcript: t, durationSec: dur, audioUrl, analysis: anal(t, dur) });
    });
    typedBox.querySelector('[data-typed-back]').addEventListener('click', () => exitTyping());
  }

  function exitTyping() {
    if (!typing) return;
    typing = false;
    block.classList.remove('typing');
    panel.classList.remove('typing');
    typedBox.hidden = true;
    typedBox.innerHTML = '';
    row.hidden = false;
    status.hidden = false;
    const p = typingPrev || {};
    typingPrev = null;
    if (card) card.hidden = !!p.card;
    after.hidden = p.after !== false;
    // The note was seen already: come back as the chip (never both).
    if (note) note.hidden = true;
    if (chip) chip.hidden = false;
  }

  function done(take) {
    if (finished) return;
    if (typing) exitTyping();
    finished = true;
    carry = null;
    pauseBox.hidden = true;
    unbindHide();
    clearInterval(timer); timer = null;
    stopPulse();
    typeBtn.style.visibility = 'hidden'; // keep the row layout, the mic stays centered
    if (selfBtn) selfBtn.style.visibility = 'hidden';
    clearErr();
    after.hidden = true;
    btn.disabled = true;
    mic.dataset.state = 'done';
    setHint(take.mode === 'speech' ? 'נקלט' : 'נשמר');
    setTime('');
    try { opts.onDone && opts.onDone(take); } finally { emitEnd({ done: true, reason: take.mode }); }
  }

  // speech.js ends the take itself when the page goes hidden (no error). Finish it here too,
  // so coming back to the app shows the result instead of a stuck "listening" mic.
  // Bound only while a take runs (bindHide in start, unbindHide when it ends).
  function onHide(e) {
    if (e.type === 'pagehide' ? (state === 'listening' || state === 'starting') : (document.visibilityState === 'hidden' && state === 'listening')) stop();
  }
  ctx.onLeave(() => {
    unbindHide();
    finished = true;
    try { sess && sess.cancel(); } catch { /* ignore */ }
    clearInterval(timer);
    stopPulse();
  });

  btn.addEventListener('click', () => (state === 'idle' ? start() : (state === 'listening' || state === 'starting') ? stop() : null));
  pauseBox.querySelector('[data-cont]').addEventListener('click', () => { if (state === 'idle' && carry) start(); });
  pauseBox.querySelector('[data-finish]').addEventListener('click', finishCarry);
  retryBtn.addEventListener('click', () => { if (state === 'idle') start(takeKind === 'record' ? 'record' : undefined); });
  typeBtn.addEventListener('click', () => typed());
  selfBtn?.addEventListener('click', () => {
    if (mobileRec) {
      if (state === 'idle') start('record');
      else if (takeKind === 'record' && (state === 'listening' || state === 'starting')) stop();
      return;
    }
    if (state !== 'listening' && state !== 'starting') fallback(null, 0);
  });
  // Full note or chip, never both: the chip opens the note, a tap on the note folds it back.
  chip?.addEventListener('click', () => {
    if (!note || typing) return;
    note.hidden = false;
    chip.hidden = true;
  });
  note?.addEventListener('click', () => {
    if (!chip || typing) return;
    note.hidden = true;
    chip.hidden = false;
    try { chip.focus(); } catch { /* ignore */ }
  });
  if (noMicAtAll) fallback(null, 0);

  return {
    start: () => start(),
    stop: () => stop(),
    get recording() { return state === 'listening' || state === 'starting' || state === 'processing' || !!carry; },
    get paused() { return !!carry && state === 'idle'; },
    get typing() { return typing; },
    onEnd(fn) { if (typeof fn === 'function') endFns.push(fn); },
    el: block,
    panel,
  };
}

// Metrics kept in history: numbers only. No audio, no transcript text.
export function takeMetrics(take) {
  const a = take.analysis;
  return {
    mode: take.mode,
    fromMic: take.mode === 'speech',
    durationSec: Math.round(Number(take.durationSec) || 0),
    words: a ? a.words : 0,
    wpm: a ? a.wpm : 0,
    fillerTotal: a ? a.fillerTotal : undefined,
    fillersPerMin: a && take.mode === 'speech' ? a.fillersPerMin : undefined,
    fillers: a && a.fillers ? { ...a.fillers } : {},
    beDrops: a && a.beDrops ? a.beDrops.length : 0,
    targetScore: a ? a.targetScore : null,
    selfRated: take.selfScore != null,
  };
}

export function takeScore(take) {
  if (take.selfScore != null) return take.selfScore;
  return take.analysis ? take.analysis.score : 0;
}
