// Recall: a script from memory. Cloze levels hide more words, then speak it and diff.
// The level is locked while recording; the bonus uses the level the take started with.
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
  const reps = st ? Number(st.reps) || 0 : 0;
  // Never start on level 0 (that is reading, not recall). The cloze changes with each attempt.
  let level = Math.max(1, Math.min(4, reps + 1));
  const seed = 1 + (reps % 3);
  let rec = null;
  let levelAtStart = level;

  el.innerHTML = `<div class="stack">
    <div class="card recall-card">
      <div class="spread"><span class="tag">${icon('scripts')} <bdi dir="rtl">${esc(item.title_he)}</bdi></span>
        <button class="icon-btn light" data-peek aria-label="החזק כדי לראות הכול">${icon('eye')}</button></div>
      <div class="levels" role="group" aria-label="כמה להסתיר">
        ${LEVELS.map((l, k) => `<button class="lvl-pip" data-l="${k}" aria-pressed="${k === level}" aria-label="רמה ${k + 1}: ${l}">${k + 1}</button>`).join('')}
        <span class="tiny muted lvl-name"></span>
      </div>
      <p class="en cloze" dir="ltr" lang="en" data-cloze></p>
      <p class="tiny muted">קרא בשקט, הסתר עוד, ואז אמור הכול בקול.${item.why_he ? ` ${esc(item.why_he)}` : ''}</p>
    </div>
    <div class="play-dock" data-mic></div>
  </div>`;

  const cz = el.querySelector('[data-cloze]');
  const draw = (lv = level) => {
    cz.innerHTML = clozeHtml(item.text_en, lv, seed);
    el.querySelector('.lvl-name').textContent = LEVELS[level];
  };
  draw();
  const recording = () => !!(rec && rec.recording);
  el.querySelector('.levels').addEventListener('click', (e) => {
    const b = e.target.closest('[data-l]');
    if (!b || recording()) return;
    level = Number(b.dataset.l);
    el.querySelectorAll('[data-l]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    ctx.haptic(8);
    draw();
  });
  const peek = el.querySelector('[data-peek]');
  const showAll = () => { if (!recording()) draw(0); };
  const back = () => draw(level);
  peek.addEventListener('pointerdown', showAll);
  peek.addEventListener('pointerup', back);
  peek.addEventListener('pointerleave', back);
  peek.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showAll(); setTimeout(back, 2500); } });
  const lock = (on) => {
    el.querySelectorAll('[data-l]').forEach((x) => { x.disabled = on; });
    peek.disabled = on;
  };

  rec = micPanel(el.querySelector('[data-mic]'), ctx, {
    target: item.text_en,
    analyze: { target: item.text_en },
    live: true,
    compact: true,
    size: 88,
    label: 'הקלט את הטקסט',
    onStart: () => { levelAtStart = level; lock(true); draw(level); },
    // An empty, failed or cancelled take ends without onDone: onEnd unlocks the levels and the peek.
    onEnd: () => lock(false),
    onDone: (take) => {
      lock(false);
      // Level bonus: harder level, small boost, never above 100.
      const base = takeScore(take);
      const score = take.analysis ? Math.min(100, Math.round(base * (0.85 + levelAtStart * 0.05))) : base;
      const reveal = `<div class="reveal"><p class="en small" dir="ltr" lang="en">${esc(item.text_en)}</p></div>`;
      finish({ score, take, revealHtml: reveal, revealLabel: 'הצג את הטקסט המלא' });
    },
  });
  // Safety net: whatever ends the take, the mic going back to idle (or off) unlocks the controls.
  const micEl = el.querySelector('[data-mic] .mic');
  if (micEl && typeof MutationObserver === 'function') {
    const mo = new MutationObserver(() => {
      if (!el.isConnected) { mo.disconnect(); return; }
      if (['idle', 'off', 'error', 'done'].includes(micEl.dataset.state)) lock(false);
    });
    mo.observe(micEl, { attributes: true, attributeFilter: ['data-state'] });
    ctx.onLeave(() => mo.disconnect());
  }
}
