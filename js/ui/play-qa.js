// QA: a tough question. Think 5 seconds, answer by voice, then see a model answer.
import { esc, ringSvg, setRing, fmtTime } from './dom.js';
import { icon } from './icons.js';
import { micPanel, takeScore } from './mic.js';
import { listenBtn, bindListen } from './tts.js';

export function mount(el, item, api) {
  const { ctx, finish } = api;
  el.innerHTML = `<div class="stack">
    <div class="card q-card">
      <span class="tag">${icon('users')} שאלה מהקהל</span>
      <p class="en question" dir="ltr" lang="en">"${esc(item.question_en)}"</p>
      <div class="row">${listenBtn('הקשב לשאלה')}</div>
      ${item.why_he ? `<p class="small muted">${icon('bulb')} ${esc(item.why_he)}</p>` : ''}
    </div>
    <div class="think card flat" data-think>
      ${ringSvg(100, { size: 92, stroke: 8, cls: 'think-ring', label: '<b class="think-n">5</b>' })}
      <div class="grow">
        <div class="bold">חשוב 5 שניות</div>
        <p class="small muted">תשובה קודם, הסבר אחר כך. משפט ראשון קצר.</p>
        <button class="link-btn" data-skip>אני מוכן ${icon('chevL')}</button>
      </div>
    </div>
    <div data-mic hidden></div>
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
    think.classList.add('gone');
    setTimeout(() => { think.hidden = true; }, 250);
    micHost.hidden = false;
    ctx.haptic(15);
    api.pill(`<bdi class="en-num" data-timer>${fmtTime(60)}</bdi>${icon('timer')}`);
    const timerEl = document.querySelector('[data-timer]');
    micPanel(micHost, ctx, {
      seconds: 60,
      label: 'ענה עכשיו',
      onTick: (left) => { if (timerEl) timerEl.textContent = fmtTime(left); },
      onDone: (take) => {
        const reveal = `<div class="reveal">
          <div class="spread"><div class="tiny muted">תשובה לדוגמה</div>${listenBtn('הקשב')}</div>
          <p class="en model" dir="ltr">${esc(item.model_en)}</p>
          ${item.note_he ? `<p class="small">${icon('bulb')} ${esc(item.note_he)}</p>` : ''}
        </div>`;
        finish({ score: takeScore(take), take, revealHtml: reveal, afterFeedback: (fb) => bindListen(fb, item.model_en) });
      },
    });
    micHost.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  el.querySelector('[data-skip]').addEventListener('click', go);
}
