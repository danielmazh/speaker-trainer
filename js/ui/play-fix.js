// Fix: a common wrong sentence. The words to change are marked before the user speaks, the rule
// sits under the sentence, and two help levels are always one tap away: "רמז" shows the corrected
// words in place, "הצג תשובה" shows the whole right sentence. After help the user still says it
// aloud (repeat after). Score: no help = full, hint = 80 %, answer = 60 %.
// Scoring leans on the changed words (must / banned from fixWordSets, targetEase), so a right fix
// with small wording changes elsewhere still passes. No mic: the mic block falls back to typing.
import { esc } from './dom.js';
import { icon } from './icons.js';
import { micPanel, takeScore } from './mic.js';
import { listenBtn, bindListen } from './tts.js';

// Help level per item, in memory only (0 none, 1 hint, 2 answer). Kept across a retry.
const helpUsed = new Map();
export const HELP_FACTOR = [1, 0.8, 0.6];
const HELP_NOTE = ['', 'עם רמז', 'עם תשובה'];
// The share of the target sentence that must be said for full credit (see analyze targetEase).
const TARGET_EASE = 0.7;

// Wrong sentence with marks: changed words get a red wavy underline, missing words a caret gap.
// The corrected words are in the markup already (.fx-new) and show only on a hint or the answer.
function wrongHtml(m) {
  const gap = (text) => `<span class="fx-gap" data-testid="fix-gap"><span class="fx-blank" aria-hidden="true"></span><ins class="fx-new">${esc(text)}</ins><span class="sr-only" lang="he" dir="rtl">(חסרה מילה)</span></span>`;
  const parts = m.wrong.map((t) => {
    let s = t.gap ? `${gap(t.gap)} ` : '';
    s += t.bad ? `<mark class="fx-bad" data-testid="fix-bad">${esc(t.text)}</mark>` : esc(t.text);
    if (t.fix) s += ` <ins class="fx-new fx-after">${esc(t.fix)}</ins>`;
    return s;
  });
  if (m.end) parts.push(gap(m.end));
  return parts.join(' ');
}

function rightHtml(m) {
  return m.right.map((t) => (t.add ? `<b class="fx-add">${esc(t.text)}</b>` : esc(t.text))).join(' ');
}

// "מה היה צריך לתקן": wrong -> right for the changed words only.
function changesHtml(m) {
  return m.changes.slice(0, 4).map((c) => {
    const body = !c.from ? `${c.before ? `<span class="fx-ctx">${esc(c.before)}</span> ` : ''}<b class="fx-ins">${esc(c.to)}</b>${c.after ? ` <span class="fx-ctx">${esc(c.after)}</span>` : ''}`
      : !c.to ? `<s>${esc(c.from)}</s> <span class="tiny muted" dir="rtl">(להוריד)</span>`
        : `<s>${esc(c.from)}</s> ${icon('arrowR')} <b>${esc(c.to)}</b>`;
    return `<li class="en fix-pair" dir="ltr" lang="en">${body}</li>`;
  }).join('');
}

export function mount(el, item, api) {
  const { ctx, finish } = api;
  const A = ctx.A;
  const marks = A.fixMarks(item.right, item.wrong);
  const rule = item.note_he || item.why_he || '';
  let level = helpUsed.get(item.id) || 0;

  el.innerHTML = `<div class="stack fix-drill">
    <div class="card fix-card" data-testid="fix-card" data-help="${level}">
      <p class="fix-instr">${icon('target')}<span>תקן את המילים המסומנות ואמור את כל המשפט בקול</span></p>
      <p class="en fix-wrong" dir="ltr" lang="en" data-testid="fix-wrong">${wrongHtml(marks)}</p>
      ${rule ? `<p class="fix-rule" data-testid="fix-rule">${icon('bulb')}<span dir="auto">${esc(rule)}</span></p>` : ''}
      <div class="fix-answer" data-testid="fix-answer-box" ${level >= 2 ? '' : 'hidden'}>
        <p class="en fix-right" dir="ltr" lang="en">${rightHtml(marks)}</p>
        ${listenBtn('הקשב')}
      </div>
      <div class="fix-help" role="group" aria-label="עזרה" ${level >= 2 ? 'hidden' : ''}>
        <button class="btn line sm" data-hint data-testid="fix-hint" aria-pressed="${level >= 1}" ${level >= 1 ? 'disabled' : ''}>${icon('bulb')} רמז</button>
        <button class="btn line sm" data-peek data-testid="fix-answer" aria-pressed="${level >= 2}" ${level >= 2 ? 'disabled' : ''}>${icon('eye')} הצג תשובה</button>
      </div>
    </div>
    <div class="play-dock">
      <div data-mic></div>
    </div>
  </div>`;

  const card = el.querySelector('.fix-card');
  const hintBtn = el.querySelector('[data-hint]');
  const peekBtn = el.querySelector('[data-peek]');
  const answer = el.querySelector('.fix-answer');
  bindListen(answer, item.right);

  function setLevel(n) {
    if (n <= level) return;
    level = n;
    helpUsed.set(item.id, n);
    card.dataset.help = String(n);
    hintBtn.disabled = true;
    hintBtn.setAttribute('aria-pressed', 'true');
    if (n >= 2) {
      // The answer takes the place of the help row, so the mic barely moves.
      answer.hidden = false;
      el.querySelector('.fix-help').hidden = true;
      peekBtn.disabled = true;
      peekBtn.setAttribute('aria-pressed', 'true');
    }
    ctx.sound?.('tap');
  }
  hintBtn.addEventListener('click', () => setLevel(1));
  peekBtn.addEventListener('click', () => setLevel(2));

  const reveal = `<div class="reveal fix-review" data-testid="fix-review">
    <div class="spread"><div class="tiny muted">מה היה צריך לתקן</div>${listenBtn('הקשב')}</div>
    <ul class="fix-changes">${changesHtml(marks)}</ul>
    ${rule ? `<p class="small">${icon('bulb')} <span dir="auto">${esc(rule)}</span></p>` : ''}
  </div>`;

  // Words that make the fix: right-only words must be said, wrong-only words must not.
  // Built through analyze's own normalization so the right sentence always scores in full.
  const { must, banned } = A.fixWordSets(item.right, item.wrong);
  micPanel(el.querySelector('[data-mic]'), ctx, {
    target: item.right,
    avoid: item.wrong,
    must, banned,
    analyze: { target: item.right, avoid: item.wrong, must, banned, targetEase: TARGET_EASE },
    live: true,
    compact: true,
    size: 88,
    label: 'הקלט את המשפט המתוקן',
    noSelf: true,
    onDone: (take) => {
      hintBtn.disabled = true;
      peekBtn.disabled = true;
      const score = Math.round(takeScore(take) * HELP_FACTOR[level]);
      finish({
        score, take, revealHtml: reveal, helpNote: HELP_NOTE[level],
        afterFeedback: (fb) => bindListen(fb, item.right),
      });
    },
  });
}
