// QA: a tough question. Think 5 seconds (small ring next to the question), then answer by voice in the dock.
import { esc, ringSvg, setRing, fmtTime } from './dom.js';
import { icon } from './icons.js';
import { micPanel, takeScore } from './mic.js';
import { listenBtn, bindListen } from './tts.js';

export function mount(el, item, api) {
  const { ctx, finish } = api;
  el.innerHTML = `<div class="stack">
    <div class="card q-card">
      <div class="spread"><span class="tag">${icon('users')} שאלה מהקהל</span>${listenBtn('הקשב')}</div>
      <p class="en question" dir="ltr" lang="en">"${esc(item.question_en)}"</p>
      ${item.why_he ? `<p class="small muted">${icon('bulb')} ${esc(item.why_he)}</p>` : ''}
    </div>
    <div class="play-dock">
      <div class="think" data-think>
        ${ringSvg(100, { size: 56, stroke: 6, cls: 'think-ring', label: '<b class="think-n">5</b>' })}
        <div class="grow">
          <div class="bold">חשוב 5 שניות</div>
          <p class="tiny muted">תשובה קודם, הסבר אחר כך.</p>
        </div>
        <button class="btn sm" data-skip>אני מוכן ${icon('chevL')}</button>
      </div>
      <div data-mic hidden></div>
    </div>
  </div>`;
  bindListen(el, item.question_en);

  const think = el.querySelector('[data-think]');
  const micHost = el.querySelector('[data-mic]');
  const ring = think.querySelector('.think-ring');
  const n = think.querySelector('.think-n');
  let left = 5;
  const tmr = setInterval(() => {
    left -= 1;
    n.textContent = String(Math.max(0, left));
    setRing(ring, (left / 5) * 100);
    if (left <= 0) go();
  }, 1000);
  ctx.onLeave(() => clearInterval(tmr));

  let started = false;
  function go() {
    if (started) return;
    started = true;
    clearInterval(tmr);
    try { speechSynthesis.cancel(); } catch { /* ignore */ }
    think.hidden = true;
    micHost.hidden = false;
    ctx.haptic(15);
    api.pill(`<bdi class="en-num" data-timer>${fmtTime(60)}</bdi>${icon('timer')}`);
    const timerEl = document.querySelector('[data-timer]');
    micPanel(micHost, ctx, {
      seconds: 60,
      compact: true,
      size: 88,
      reference: item.model_en,
      minWords: 12,
      analyze: { reference: item.model_en, minWords: 12 },
      label: 'ענה עכשיו',
      onTick: (left) => { if (timerEl) timerEl.textContent = fmtTime(left); },
      onDone: (take) => {
        const reveal = `<div class="reveal">
          <div class="spread"><div class="tiny muted">תשובה לדוגמה</div>${listenBtn('הקשב')}</div>
          <p class="en model" dir="ltr" lang="en">${esc(item.model_en)}</p>
          ${item.note_he ? `<p class="small">${icon('bulb')} ${esc(item.note_he)}</p>` : ''}
        </div>`;
        finish({ score: takeScore(take), take, revealHtml: reveal, revealLabel: 'הצג תשובה לדוגמה', afterFeedback: (fb) => bindListen(fb, item.model_en) });
      },
    });
  }
  el.querySelector('[data-skip]').addEventListener('click', go);
}
