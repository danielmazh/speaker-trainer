// Choice: pick the natural English. Instant feedback and haptics.
// Options are shuffled on every render; data-k keeps the original index, so the right answer maps correctly.
import { esc } from './dom.js';
import { icon } from './icons.js';
import { listenBtn, bindListen } from './tts.js';

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9']+/g, ' ').trim();

export function mount(el, item, { ctx, finish }) {
  const opts = (item.options || []).map((t, k) => ({ t, k }));
  for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }

  // Word stress items put the word itself in `wrong`: show it neutral, not as a mistake.
  const stress = item.cat === 'stress';
  // Never quote an option word for word: the task would become "do not pick the quoted one".
  const quoteIsOption = !stress && item.wrong && (item.options || []).some((o) => norm(o) === norm(item.wrong));
  const showQuote = item.wrong && (stress || !quoteIsOption);
  // The label "טעות נפוצה:" is already shown above the quote: do not say it twice.
  const why = showQuote && !stress ? String(item.why_he || '').replace(/^\s*טעות נפוצה:\s*/, '') : String(item.why_he || '');
  el.innerHTML = `<div class="stack">
    ${showQuote || why ? `<div class="card stack-sm">
      ${stress
        ? `<div class="tiny muted bold">איפה הדגש?</div>
      <p class="en quote-neutral" dir="ltr" lang="en" data-testid="choice-prompt">${esc(item.wrong)}</p>`
        : showQuote ? `<div class="tiny muted bold">טעות נפוצה:</div>
      <blockquote class="en quote-bad italic" dir="ltr" lang="en" data-testid="choice-prompt">${esc(item.wrong)}</blockquote>` : ''}
      ${why ? `<p class="small muted">${esc(why)}</p>` : ''}
    </div>` : ''}
    <div class="options" role="group" aria-label="אפשרויות">
      ${opts.map((o, n) => `<button class="opt" dir="ltr" lang="en" data-k="${o.k}"><span class="opt-l">${'ABCD'[n] || n + 1}</span><span class="opt-t">${esc(o.t)}</span></button>`).join('')}
    </div>
  </div>`;

  const right = item.options[item.correct];
  let tmr = 0;
  ctx.onLeave(() => clearTimeout(tmr));
  el.querySelector('.options').addEventListener('click', (e) => {
    const b = e.target.closest('.opt');
    if (!b || el.querySelector('.opt.picked')) return;
    const ok = Number(b.dataset.k) === item.correct;
    b.classList.add('picked', ok ? 'right' : 'wrong');
    b.querySelector('.opt-l').innerHTML = icon(ok ? 'check' : 'x');
    if (!ok) {
      const r = el.querySelector(`.opt[data-k="${item.correct}"]`);
      r.classList.add('right');
      r.querySelector('.opt-l').innerHTML = icon('check');
    }
    el.querySelectorAll('.opt').forEach((x) => { x.disabled = true; if (!x.classList.contains('right') && !x.classList.contains('wrong')) x.classList.add('dim'); });
    ctx.sound(ok ? 'good' : 'bad');
    ctx.haptic(ok ? 18 : [40, 30, 40]);
    const reveal = `<div class="reveal">
      ${item.note_he ? `<p class="small">${icon('bulb')} ${esc(item.note_he)}</p>` : ''}
      <div class="row">${listenBtn('הקשב')}<span class="tiny muted">עכשיו אמור את זה בקול פעם אחת.</span></div>
    </div>`;
    tmr = setTimeout(() => {
      finish({
        score: ok ? 100 : 0, mode: 'tap', silent: true,
        choice: { picked: item.options[Number(b.dataset.k)], right },
        title: ok ? 'נכון, כל הכבוד!' : 'לא בדיוק. ככה זה נשמע טבעי:',
        rule: right, revealHtml: reveal,
        afterFeedback: (fb) => bindListen(fb, right),
      });
    }, 450);
  });
}
