// Speak: the hero screen. Prompt and must-say chips in the band, timer pill,
// live transcript with fillers, live counters, big mic with level ring, banned chips that shake.
import { esc, fmtTime } from './dom.js';
import { icon } from './icons.js';
import { micPanel, takeScore } from './mic.js';
import { listenBtn, bindListen } from './tts.js';

export function mount(el, item, api) {
  const { ctx, finish } = api;
  const must = item.must || [];
  const banned = item.banned || [];
  const seconds = Number(item.seconds) || 60;

  api.band({
    title: item.title_he || 'דבר בקול',
    extra: `<p class="band-prompt en" dir="ltr" lang="en">${esc(item.prompt_en)}</p>
      ${must.length ? `<div class="must-row" aria-label="מילים שחובה להגיד">${must.map((m, k) => `<span class="must-chip" data-m="${k}"><span class="mc-ic">${icon('circleDashed')}</span><bdi>${esc(m)}</bdi></span>`).join('')}</div>` : ''}`,
  });
  api.pill(`<bdi class="en-num" data-timer>${fmtTime(seconds)}</bdi>${icon('timer')}`);
  const timerEl = document.querySelector('[data-timer]');

  const counters = `<div class="counters" aria-live="off">
    <div class="counter" data-k="must"><span class="cv"><span class="cdot">${icon(must.length ? 'target' : 'message')}</span><b class="en-num"><bdi>${must.length ? `0/${must.length}` : '0'}</bdi></b></span><span class="cl">${must.length ? 'מילות חובה' : 'מילים'}</span></div>
    <div class="counter" data-k="fpm"><span class="cv"><span class="cdot">${icon('mute')}</span><b>0</b></span><span class="cl">מילוי לדקה</span></div>
    <div class="counter" data-k="wpm"><span class="cv"><span class="cdot">${icon('gauge')}</span><b>-</b></span><span class="cl">מילים לדקה</span></div>
  </div>`;

  el.innerHTML = `<div class="stack speak">
    ${item.why_he ? `<p class="note">${icon('bulb')}<span>${esc(item.why_he)}</span></p>` : ''}
    ${banned.length ? `<div class="ban-row"><span class="tiny muted">בלי:</span>${banned.map((m, k) => `<span class="ban-chip" data-b="${k}"><bdi>${esc(m)}</bdi></span>`).join('')}</div>` : ''}
    <div data-mic></div>
  </div>`;

  const banCounts = banned.map(() => 0);
  let lastFill = 0;
  const cval = (k) => el.querySelector(`[data-k="${k}"] b`);
  const ctile = (k) => el.querySelector(`[data-k="${k}"]`);
  const tone = (k, t) => { ctile(k).dataset.tone = t; };

  function update(a, _text, elapsed) {
    if (!el.querySelector('.counters')) return;
    const wpmOk = elapsed >= 5 && a.words >= 5;
    cval('wpm').textContent = wpmOk ? String(a.wpm) : '-';
    tone('wpm', !wpmOk ? '' : a.wpm >= 110 && a.wpm <= 160 ? 'good' : 'warn');
    cval('fpm').textContent = String(a.fillersPerMin || 0);
    tone('fpm', a.words < 4 ? '' : a.fillersPerMin < 1 ? 'good' : a.fillersPerMin <= 3 ? 'warn' : 'bad');
    const hit = new Set(a.mustHit || []);
    cval('must').innerHTML = must.length ? `<bdi>${hit.size}/${must.length}</bdi>` : String(a.words);
    tone('must', 'primary');
    if (a.fillerTotal > lastFill) {
      lastFill = a.fillerTotal;
      const f = ctile('fpm');
      f.classList.remove('bump'); void f.offsetWidth; f.classList.add('bump');
      ctx.haptic(12);
    }
    document.querySelectorAll('.must-chip').forEach((s) => {
      const on = hit.has(must[Number(s.dataset.m)]);
      if (on && !s.classList.contains('on')) {
        s.querySelector('.mc-ic').innerHTML = icon('check');
        ctx.sound('tap');
      }
      s.classList.toggle('on', on);
    });
    const bh = new Map((a.banned || []).map((b) => [b.phrase, b.count]));
    el.querySelectorAll('[data-b]').forEach((s) => {
      const k = Number(s.dataset.b);
      const n = bh.get(banned[k]) || 0;
      if (n > banCounts[k]) {
        banCounts[k] = n;
        s.classList.add('hit');
        s.classList.remove('shake'); void s.offsetWidth; s.classList.add('shake');
        ctx.haptic([40, 30, 40]);
      }
    });
  }

  micPanel(el.querySelector('[data-mic]'), ctx, {
    size: 176,
    seconds,
    must, banned,
    between: counters,
    label: 'התחל לדבר',
    onTick: (left) => { if (timerEl) timerEl.textContent = fmtTime(left); },
    onLive: update,
    onDone: (take) => {
      if (take.analysis) update(take.analysis, take.transcript, take.durationSec);
      const reveal = `<div class="reveal">
        <div class="spread"><div class="tiny muted">ככה זה יכול להישמע</div>${listenBtn('הקשב')}</div>
        <p class="en model" dir="ltr">${esc(item.model_en)}</p>
        ${item.bad ? `<div class="tiny muted">ככה לא:</div><p class="en quote-bad small" dir="ltr">${esc(item.bad)}</p>` : ''}
      </div>`;
      finish({ score: takeScore(take), take, revealHtml: reveal, afterFeedback: (fb) => bindListen(fb, item.model_en) });
    },
  });
}
