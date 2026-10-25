// Fix: a common wrong sentence. Say the corrected one aloud. The mic and "show the answer" sit in the sticky dock.
// Fallback: reveal the answer and rate yourself.
import { esc } from './dom.js';
import { icon } from './icons.js';
import { micPanel, takeScore, starsHtml, bindStars } from './mic.js';
import { listenBtn, bindListen } from './tts.js';

export function mount(el, item, api) {
  const { ctx, finish } = api;
  const reveal = `<div class="reveal">
    <div class="spread"><div class="tiny muted">הגרסה הנכונה</div>${listenBtn('הקשב')}</div>
    <p class="en good-text" dir="ltr" lang="en">${esc(item.right)}</p>
    ${item.note_he ? `<p class="small">${icon('bulb')} ${esc(item.note_he)}</p>` : ''}
  </div>`;

  el.innerHTML = `<div class="stack">
    <div class="card stack-sm">
      <div class="card-head">
        <span class="tag bad">${icon('x')} טעות נפוצה</span>
        ${item.why_he ? `<button class="icon-btn light sm-ic" data-why aria-expanded="false" aria-controls="why-${esc(item.id)}" aria-label="למה זו טעות?">${icon('info')}</button>` : ''}
      </div>
      <blockquote class="en quote-bad" dir="ltr" lang="en">${esc(item.wrong)}</blockquote>
      ${item.why_he ? `<p class="note" id="why-${esc(item.id)}" hidden>${icon('bulb')}<span>${esc(item.why_he)}</span></p>` : ''}
    </div>
    <div data-peekbox></div>
    <div class="play-dock">
      <div data-mic></div>
      <button class="link-btn center-self" data-peek>${icon('eye')} לא בטוח? הצג תשובה</button>
    </div>
  </div>`;

  const whyBtn = el.querySelector('[data-why]');
  whyBtn?.addEventListener('click', () => {
    const n = el.querySelector('.note');
    n.hidden = !n.hidden;
    whyBtn.setAttribute('aria-expanded', String(!n.hidden));
  });

  // Words that make the fix: right-only words must be said, wrong-only words must not.
  const words = (t) => ctx.A.tokenize(String(t || '')).map((x) => String(x.norm || x.w || '').toLowerCase()).filter(Boolean);
  const rightW = words(item.right), wrongW = words(item.wrong);
  const must = [...new Set(rightW.filter((w) => !wrongW.includes(w)))];
  const banned = [...new Set(wrongW.filter((w) => !rightW.includes(w)))];
  const peekBtn = el.querySelector('[data-peek]');
  micPanel(el.querySelector('[data-mic]'), ctx, {
    target: item.right,
    avoid: item.wrong,
    must, banned,
    analyze: { target: item.right, avoid: item.wrong, must, banned },
    live: true,
    compact: true,
    size: 88,
    label: 'הקלט את המשפט המתוקן',
    noSelf: true,
    onDone: (take) => {
      peekBtn.hidden = true;
      finish({ score: takeScore(take), take, revealHtml: reveal, afterFeedback: (fb) => bindListen(fb, item.right) });
    },
  });

  peekBtn.addEventListener('click', () => {
    el.querySelector('.play-dock').hidden = true;
    const box = el.querySelector('[data-peekbox]');
    box.innerHTML = `<div class="card stack-sm">${reveal}
      <p class="small">אמור אותו בקול פעם אחת. כמה היית קרוב לפני שראית?</p>
      ${starsHtml('fixstars')}
    </div>`;
    bindListen(box, item.right);
    bindStars(box, (n) => finish({ score: n * 20, take: { mode: 'self', selfScore: n * 20, transcript: '', durationSec: 0, analysis: null } }));
  });
}
