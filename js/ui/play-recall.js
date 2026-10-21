// Recall: a script from memory. Cloze levels hide more words, then speak it and diff.
import { esc } from './dom.js';
import { icon } from './icons.js';
import { micPanel, takeScore } from './mic.js';

const LEVELS = ['כל הטקסט', 'כל מילה שלישית', 'חצי מוסתר', 'רק אות ראשונה', 'הכול מוסתר'];

function clozeHtml(text, level, seed = 1) {
  return text.split(/\s+/).map((w, i) => {
    let hide = false;
    if (level === 1) hide = (i + seed) % 3 === 0;
    else if (level === 2) hide = (i + seed) % 2 === 0;
    else if (level >= 3) hide = true;
    if (!hide) return `<span class="w">${esc(w)}</span>`;
    if (level === 3) {
      const m = w.match(/^([^A-Za-z0-9]*)([A-Za-z0-9])(.*)$/);
      if (m) return `<span class="w first">${esc(m[1] + m[2])}${'_'.repeat(Math.min(m[3].length, 8))}</span>`;
    }
    return `<span class="w hid" aria-hidden="true">${esc(w)}</span>`;
  }).join(' ');
}

export function mount(el, item, { ctx, finish }) {
  const st = ctx.state.items[item.id];
  let level = Math.min(4, st ? (st.reps || 0) + 1 : 0);

  el.innerHTML = `<div class="stack">
    <div class="card">
      <div class="spread"><span class="tag">${icon('scripts')} ${esc(item.title_he)}</span>${item.src ? `<span class="ts-chip"><bdi class="ts" dir="ltr">[${esc(item.src)}]</bdi></span>` : ''}</div>
      ${item.why_he ? `<p class="small muted" style="margin-top:8px">${icon('bulb')} ${esc(item.why_he)}</p>` : ''}
      <div class="levels" role="group" aria-label="כמה להסתיר">
        ${LEVELS.map((l, k) => `<button class="lvl-pip" data-l="${k}" aria-pressed="${k === level}" aria-label="רמה ${k + 1}: ${l}">${k + 1}</button>`).join('')}
        <span class="tiny muted lvl-name"></span>
      </div>
      <p class="en cloze" dir="ltr" lang="en" data-cloze></p>
      <button class="link-btn" data-peek>${icon('eye')} החזק כדי לראות הכול</button>
    </div>
    <div class="note">${icon('mic')}<span>קרא פעם אחת בשקט, הסתר עוד, ואז אמור את כל הטקסט בקול.</span></div>
    <div data-mic></div>
  </div>`;

  const cz = el.querySelector('[data-cloze]');
  const draw = (lv = level) => {
    cz.innerHTML = clozeHtml(item.text_en, lv);
    el.querySelector('.lvl-name').textContent = LEVELS[level];
  };
  draw();
  el.querySelector('.levels').addEventListener('click', (e) => {
    const b = e.target.closest('[data-l]');
    if (!b) return;
    level = Number(b.dataset.l);
    el.querySelectorAll('[data-l]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    ctx.haptic(8);
    draw();
  });
  const peek = el.querySelector('[data-peek]');
  const showAll = () => draw(0);
  const back = () => draw(level);
  peek.addEventListener('pointerdown', showAll);
  peek.addEventListener('pointerup', back);
  peek.addEventListener('pointerleave', back);
  peek.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showAll(); setTimeout(back, 2500); } });

  micPanel(el.querySelector('[data-mic]'), ctx, {
    target: item.text_en,
    live: true,
    label: 'הקלט את הטקסט',
    onStart: () => draw(level),
    onDone: (take) => {
      // Level bonus: harder level, small boost, never above 100.
      const base = takeScore(take);
      const score = take.analysis ? Math.min(100, Math.round(base * (0.85 + level * 0.05))) : base;
      const reveal = `<div class="reveal"><div class="tiny muted">הטקסט המלא</div><p class="en small" dir="ltr">${esc(item.text_en)}</p></div>`;
      finish({ score, take, revealHtml: reveal });
    },
  });
}

