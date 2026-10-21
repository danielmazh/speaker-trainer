// Choice: pick the natural English. Instant feedback and haptics.
import { esc } from './dom.js';
import { icon } from './icons.js';
import { listenBtn, bindListen } from './tts.js';

export function mount(el, item, { ctx, finish }) {
  const opts = (item.options || []).map((t, k) => ({ t, k }));
  // Stable shuffle per item so the right answer is not always first.
  let h = 0;
  for (const c of item.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  for (let i = opts.length - 1; i > 0; i--) { h = (h * 1103515245 + 12345) >>> 0; const j = h % (i + 1); [opts[i], opts[j]] = [opts[j], opts[i]]; }

  el.innerHTML = `<div class="stack">
    <div class="card stack-sm">
      <div class="tiny muted bold">נאמר בהרצאה${item.src ? ` <span class="ts">[${esc(item.src)}]</span>` : ''}:</div>
      ${item.wrong ? `<blockquote class="en quote-bad italic" dir="ltr" lang="en">${esc(item.wrong)}</blockquote>` : ''}
      ${item.why_he ? `<p class="small muted">${esc(item.why_he)}</p>` : ''}
    </div>
    <div class="options" role="group" aria-label="אפשרויות">
      ${opts.map((o, n) => `<button class="opt" dir="ltr" lang="en" data-k="${o.k}"><span class="opt-l">${'ABCD'[n] || n + 1}</span><span class="opt-t">${esc(o.t)}</span></button>`).join('')}
    </div>
  </div>`;

  const right = item.options[item.correct];
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
    setTimeout(() => {
      finish({
        score: ok ? 100 : 0, mode: 'tap', silent: true,
        title: ok ? 'נכון, כל הכבוד!' : 'לא בדיוק. ככה זה נשמע טבעי:',
        rule: right, revealHtml: reveal,
        afterFeedback: (fb) => bindListen(fb, right),
      });
    }, 450);
  });
}
