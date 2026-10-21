// Fix: a wrong sentence from the talk. Say the corrected one aloud.
// Fallback: reveal the answer and rate yourself.
import { esc } from './dom.js';
import { icon } from './icons.js';
import { micPanel, takeScore, starsHtml, bindStars } from './mic.js';
import { listenBtn, bindListen } from './tts.js';

export function mount(el, item, api) {
  const { ctx, finish } = api;
  const reveal = `<div class="reveal">
    <div class="spread"><div class="tiny muted">הגרסה הנכונה</div>${listenBtn('הקשב')}</div>
    <p class="en good-text" dir="ltr">${esc(item.right)}</p>
    ${item.note_he ? `<p class="small">${icon('bulb')} ${esc(item.note_he)}</p>` : ''}
  </div>`;

  el.innerHTML = `<div class="stack">
    <div class="card stack-sm">
      <div class="card-head">
        <span class="tag bad">${icon('x')} לא טבעי</span>
        ${item.src ? `<span class="ts-chip"><bdi class="ts" dir="ltr">[${esc(item.src)}]</bdi></span>` : ''}
      </div>
      <blockquote class="en quote-bad" dir="ltr" lang="en">${esc(item.wrong)}</blockquote>
      ${item.why_he ? `<p class="note">${icon('bulb')}<span>${esc(item.why_he)}</span></p>` : ''}
    </div>
    <div data-mic></div>
    <button class="link-btn center-self" data-peek>${icon('eye')} לא בטוח? הצג תשובה ודרג את עצמך</button>
    <div data-peekbox></div>
  </div>`;

  const peekBtn = el.querySelector('[data-peek]');
  micPanel(el.querySelector('[data-mic]'), ctx, {
    target: item.right,
    live: true,
    size: 140,
    label: 'הקלט את המשפט המתוקן',
    noSelf: true,
    onDone: (take) => {
      peekBtn.hidden = true;
      finish({ score: takeScore(take), take, revealHtml: reveal, afterFeedback: (fb) => bindListen(fb, item.right) });
    },
  });

  peekBtn.addEventListener('click', () => {
    peekBtn.hidden = true;
    el.querySelector('[data-mic]').hidden = true;
    const box = el.querySelector('[data-peekbox]');
    box.innerHTML = `<div class="card stack-sm">${reveal}
      <p class="small">אמור אותו בקול פעם אחת. כמה היית קרוב לפני שראית?</p>
      ${starsHtml('fixstars')}
    </div>`;
    bindListen(box, item.right);
    bindStars(box, (n) => finish({ score: n * 20, take: { mode: 'self', selfScore: n * 20, transcript: '', durationSec: 0, analysis: null } }));
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}
