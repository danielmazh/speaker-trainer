// Mic panel: one spoken take. Live transcript, level ring, waveform, optional countdown,
// and full fallbacks (record and listen + self-rating, or type what you said).
// States follow docs/design-spec.md: idle, listening, processing, off.
import { esc, fmtTime } from './dom.js';
import { icon } from './icons.js';

const ERR_HE = {
  'not-allowed': 'אין גישה למיקרופון. אפשר לאשר בהגדרות האתר בדפדפן. בינתיים: הקלד מה אמרת, או דרג את עצמך.',
  'audio-capture': 'לא מצאתי מיקרופון שעובד. אפשר להקליד מה אמרת או לדרג את עצמך.',
  unsupported: 'הדפדפן הזה לא ממיר דיבור לטקסט. אני מקליט, אתה מקשיב ומדרג את עצמך. או מקליד מה אמרת.',
  'ondevice-unavailable': 'זיהוי על המכשיר לא זמין, ובחרת לא להשתמש בשירות של הדפדפן. אני רק מקליט. אפשר לשנות בפרופיל.',
  network: 'שירות הדיבור של הדפדפן לא זמין עכשיו (אולי אין רשת). אני רק מקליט. אפשר לדרג את עצמך או להקליד.',
  'no-speech': 'לא שמעתי מילים. נסה שוב, קרוב יותר למיקרופון.',
  aborted: 'זיהוי הדיבור נעצר. ההקלטה נשמרת רק בזיכרון.',
};
const FATAL = new Set(['not-allowed', 'audio-capture', 'unsupported', 'ondevice-unavailable', 'network']);
const BARS = 14;

function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

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
  return `<p class="diff en" dir="ltr" lang="en">${list.map((d) => `<span class="d-${d.status}">${esc(d.w)}</span>`).join(' ')}${more ? ` <span class="d-more">+${more} more</span>` : ''}</p>
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
 * opts: { target, must, banned, seconds, live=true, size=152, label, between (html between transcript and mic),
 *         noSelf, onLive(analysis, text, elapsed), onTick(secondsLeftOrElapsed), onStart(), onDone(take) }
 * take: { mode:'speech'|'record'|'typed'|'self', transcript, durationSec, audioUrl, analysis, selfScore }
 */
export function micPanel(host, ctx, opts = {}) {
  const { S, A } = ctx;
  const sup = S.support();
  const issue = ctx.session.micIssue && FATAL.has(ctx.session.micIssue) ? ctx.session.micIssue : null;
  const canRecord = sup.recorder;
  const canRec = sup.recognition && !issue;
  const live = opts.live !== false;
  const seconds = Number(opts.seconds) || 0;
  const size = opts.size || 152;
  const must = opts.must || [];
  const anal = (text, dur) => A.analyze(text, dur, { target: opts.target, must, banned: opts.banned });

  let sess = null, t0 = 0, timer = null, finished = false, state = 'idle', lastErr = null, lastText = '';
  const levels = new Array(BARS).fill(0);
  let lvlTick = 0;

  const preNote = !sup.recognition ? ERR_HE.unsupported : issue ? ERR_HE[issue] : '';
  const noMicAtAll = !canRecord && !sup.recognition;
  const R = 62, C = 2 * Math.PI * R;

  host.innerHTML = `<div class="mic-panel" data-testid="mic-panel">
    ${preNote ? `<div class="note warn">${icon('micOff')}<span>${esc(preNote)}</span></div>` : ''}
    <div class="mic-err note warn" hidden>${icon('circleAlert')}<span></span></div>
    ${live && canRec ? `<div class="card transcript-card">
      <div class="card-head"><span class="tiny muted bold">מה שאמרת</span><span class="live" hidden><i></i>LIVE</span></div>
      <p class="transcript en" dir="ltr" lang="en" aria-live="polite" data-testid="transcript"><span class="ph">Your words show up here...</span></p>
    </div>` : ''}
    ${opts.between || ''}
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
      <div class="wave" aria-hidden="true">${'<i></i>'.repeat(BARS)}</div>
      <div class="mic-hint">${noMicAtAll ? 'אין מיקרופון בדפדפן הזה' : 'הקש ודבר'}<bdi class="mic-time"></bdi></div>
    </div>
    <div class="mic-alt">
      <button class="link-btn" data-type data-testid="mic-type">${icon('keyboard')} הקלד מה אמרת</button>
      ${opts.noSelf ? '' : `<button class="link-btn" data-self data-testid="mic-self">${icon('starLine')} דרג את עצמך</button>`}
    </div>
    <div class="mic-after" hidden></div>
  </div>`;

  const q = (s) => host.querySelector(s);
  const mic = q('.mic');
  const btn = q('.mic-core');
  const arc = q('.lvl-arc');
  const bars = Array.from(host.querySelectorAll('.wave i'));
  const tx = q('.transcript');
  const liveTag = q('.live');
  const hint = q('.mic-hint');
  const timeEl = q('.mic-time');
  const errBox = q('.mic-err');
  const after = q('.mic-after');

  const setState = (s) => { state = s; mic.dataset.state = s; };
  const setHint = (t) => { hint.firstChild.textContent = t; };

  function showErr(code) {
    const msg = ERR_HE[code];
    if (!msg) return;
    errBox.hidden = false;
    errBox.querySelector('span').textContent = msg;
  }

  function setLevel(l) {
    const v = Math.min(1, l * 1.5);
    arc.setAttribute('stroke-dasharray', `${(C * v).toFixed(1)} ${C.toFixed(1)}`);
    mic.style.setProperty('--lvl', v.toFixed(2));
    if (++lvlTick % 2 === 0) {
      levels.shift(); levels.push(v);
      bars.forEach((b, k) => { b.style.height = `${8 + Math.round(levels[k] * 18)}px`; });
    }
  }

  function tick() {
    const el = (performance.now() - t0) / 1000;
    if (seconds) {
      const left = Math.max(0, seconds - el);
      opts.onTick ? opts.onTick(Math.ceil(left)) : (timeEl.textContent = fmtTime(Math.ceil(left)));
      if (left <= 10) mic.classList.add('ending');
      if (left <= 0) { ctx.sound('tap'); ctx.haptic([30, 40, 30]); stop(); }
    } else {
      opts.onTick ? opts.onTick(Math.floor(el)) : (timeEl.textContent = fmtTime(el));
    }
  }

  function onText(text) {
    lastText = text;
    if (tx) {
      tx.innerHTML = (segHtml(A, text, must) || '') + '<span class="caret" aria-hidden="true"></span>';
      tx.scrollTop = tx.scrollHeight;
    }
    if (opts.onLive) {
      const el = (performance.now() - t0) / 1000;
      try { opts.onLive(anal(text, el), text, el); } catch (e) { console.error(e); }
    }
  }

  async function start() {
    if (state !== 'idle') return;
    setState('listening');
    lastErr = null;
    errBox.hidden = true;
    after.hidden = true;
    ctx.haptic(15);
    btn.setAttribute('aria-pressed', 'true');
    btn.setAttribute('aria-label', 'עצור');
    setHint('מקשיב... הקש כדי לסיים');
    if (liveTag) liveTag.hidden = false;
    if (tx) tx.innerHTML = '<span class="caret" aria-hidden="true"></span>';
    sess = S.createSession({
      lang: 'en-US',
      onDevice: ctx.state.settings.onDevice || 'auto',
      record: true,
      onInterim: onText,
      onFinal: (full) => onText(full),
      onLevel: setLevel,
      onError: (code) => {
        lastErr = code;
        if (FATAL.has(code)) ctx.session.micIssue = code;
        if (code !== 'no-speech' && code !== 'aborted') showErr(code);
        if ((code === 'not-allowed' || code === 'audio-capture') && state === 'listening') stop();
      },
    });
    ctx.onLeave(() => { try { sess && sess.cancel(); } catch { /* ignore */ } clearInterval(timer); });
    opts.onStart && opts.onStart();
    t0 = performance.now();
    timer = setInterval(tick, 250);
    tick();
    await sess.start();
  }

  async function stop() {
    if (state !== 'listening') return;
    setState('processing');
    clearInterval(timer);
    mic.classList.remove('ending');
    setLevel(0);
    btn.disabled = true;
    if (liveTag) liveTag.hidden = true;
    setHint('רגע, מסכם...');
    const res = await sess.stop();
    btn.disabled = false;
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('aria-label', 'הקלט שוב');
    setState('idle');
    setHint('הקש כדי לנסות שוב');
    if (res.audioUrl) (ctx.session.urls = ctx.session.urls || []).push(res.audioUrl);
    const transcript = (res.transcript || lastText || '').trim();
    if (transcript) {
      if (tx) tx.innerHTML = segHtml(A, transcript, must);
      done({ mode: 'speech', transcript, durationSec: res.durationSec, audioUrl: res.audioUrl, analysis: anal(transcript, res.durationSec) });
      return;
    }
    if (tx) tx.innerHTML = '<span class="ph">...</span>';
    if (lastErr === 'no-speech' || (!lastErr && canRec)) showErr('no-speech');
    fallback(res.audioUrl, res.durationSec);
  }

  function fallback(audioUrl, durationSec) {
    after.hidden = false;
    after.innerHTML = `<div class="card stack-sm fallback">
      ${audioUrl ? `<button class="btn ghost sm" data-listen>${icon('headphones')} הקשב להקלטה שלך</button>` : ''}
      <p class="small">${audioUrl ? 'הקשב, ואז דרג: כמה זה היה קרוב?' : 'כמה זה היה קרוב, לדעתך?'}</p>
      ${starsHtml()}
      <button class="link-btn" data-type2>${icon('keyboard')} או הקלד מה אמרת</button>
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

  function typed(durationSec = 0, audioUrl = null) {
    if (state === 'listening') { stop(); return; }
    after.hidden = false;
    after.innerHTML = `<div class="card stack-sm">
      <label class="field"><span class="lbl">הקלד באנגלית מה אמרת (או מה היית אומר)</span>
      <textarea data-testid="typed" class="textarea en" dir="ltr" lang="en" autocomplete="off" autocapitalize="sentences" spellcheck="false" rows="3"></textarea></label>
      <button class="btn sm" data-check data-testid="typed-check">${icon('check')} בדוק</button>
    </div>`;
    const ta = after.querySelector('textarea');
    ta.focus();
    after.querySelector('[data-check]').addEventListener('click', () => {
      const t = ta.value.trim();
      if (!t) { ta.focus(); return; }
      const words = A.tokenize(t).length;
      const dur = durationSec || Math.max(5, (words / 130) * 60);
      done({ mode: 'typed', transcript: t, durationSec: dur, audioUrl, analysis: anal(t, dur) });
    });
  }

  function done(take) {
    if (finished) return;
    finished = true;
    q('.mic-alt').hidden = true;
    after.hidden = true;
    btn.disabled = true;
    mic.dataset.state = 'done';
    setHint(take.mode === 'speech' ? 'נקלט' : 'נשמר');
    timeEl.textContent = '';
    opts.onDone && opts.onDone(take);
  }

  // speech.js ends the take itself when the page goes hidden (no error). Finish it here too,
  // so coming back to the app shows the result instead of a stuck "listening" mic.
  const onHide = (e) => { if ((e.type === 'pagehide' || document.visibilityState === 'hidden') && state === 'listening') stop(); };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', onHide);
  ctx.onLeave(() => { document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', onHide); });

  btn.addEventListener('click', () => (state === 'idle' ? start() : state === 'listening' ? stop() : null));
  q('[data-type]').addEventListener('click', () => typed());
  q('[data-self]')?.addEventListener('click', () => { if (state !== 'listening') fallback(null, 0); });
  if (noMicAtAll) fallback(null, 0);

  return { start, stop, get recording() { return state === 'listening'; } };
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
