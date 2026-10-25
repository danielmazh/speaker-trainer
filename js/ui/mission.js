// Mission map: the 5 daily steps as a zigzag path with dotted links.
import { esc, on } from './dom.js';
import { icon } from './icons.js';
import { KIND, KIND_SUB } from './shell.js';

const DAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
// Node centers in % of the path width (left edge), from the design.
const XS = [75, 29, 69, 26, 66];
const STEP = 80; // px between node rows
const TOP = 40;

export function render(root, ctx) {
  const d = ctx.state.daily;
  const next = ctx.nextTask();
  // Stored state is untrusted: only numbers and escaped text reach innerHTML.
  const num = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0);
  const tasks = Array.isArray(d.tasks) ? d.tasks : [];
  const total = tasks.length;
  const done = tasks.filter((t) => d.done.includes(t.id)).length;
  const allDone = total > 0 && done >= total;
  const xpLeft = tasks.filter((t) => !d.done.includes(t.id)).reduce((a, t) => a + num(t.xp), 0) + (d.bonus ? 0 : 50);
  const mins = tasks.reduce((a, t) => a + num(t.minutes), 0);
  const day = DAYS_HE[new Date().getDay()];
  const nextIdx = next ? tasks.indexOf(next) : -1;

  const status = (t, k) => (d.done.includes(t.id) ? 'done' : k === nextIdx ? 'now' : 'locked');
  const xAt = (k) => XS[k % XS.length];

  // Dots between nodes: 8 per link, colored by the earlier node's state.
  let dots = '';
  for (let k = 0; k < total - 1; k++) {
    const x1 = xAt(k), x2 = xAt(k + 1), y1 = TOP + k * STEP, y2 = TOP + (k + 1) * STEP;
    const on = status(tasks[k], k) === 'done';
    for (let j = 1; j <= 8; j++) {
      const f = 0.12 + (j - 1) * (0.76 / 7);
      dots += `<i class="dot ${on ? 'on' : ''}" style="left:${(x1 + (x2 - x1) * f).toFixed(2)}%;top:${(y1 + (y2 - y1) * f).toFixed(1)}px"></i>`;
    }
  }

  root.innerHTML = `<section class="screen no-nav mission" data-testid="mission">
    <header class="band compact">
      <div class="band-title">
        <a class="icon-btn" href="#home" aria-label="חזרה">${icon('arrowR')}</a>
        <div class="grow"><h1>המשימה של היום</h1>
          <div class="row nowrap prog-row"><div class="bar on-band thin grow"><i style="--p:${total ? Math.round((done / total) * 100) : 0}%"></i></div><bdi class="en-num tiny bold">${done}/${total}</bdi></div>
        </div>
        ${xpLeft ? `<span class="band-pill"><bdi>+${xpLeft} XP</bdi><span class="gold-ic">${icon('starLine')}</span></span>` : `<span class="band-pill" aria-label="הושלם"><span class="gold-ic">${icon('trophy')}</span></span>`}
      </div>
      <p class="sub">יום ${day} · ${total} שלבים · <span class="nowrap-num"><bdi>${mins}</bdi> דק'</span></p>
    </header>

    <div class="body">
      <ol class="zz" style="height:${TOP + (total - 1) * STEP + 64}px" aria-label="שלבי המשימה">
        ${dots}
        ${tasks.map((t, k) => {
          const s = status(t, k);
          const kind = KIND[t.kind] || KIND.practice;
          const x = xAt(k);
          const right = x > 50;
          const xpLine = s === 'done' ? `<span class="xp-line good-ink">הושלם <bdi>+${num(t.xp)} XP</bdi></span>` : `<span class="xp-line xp-gold"><bdi>+${num(t.xp)} XP</bdi></span>`;
          return `<li class="zz-node ${s}" style="top:${TOP + k * STEP - 32}px">
            <button class="zz-dot" data-testid="mission-node" data-status="${s}" data-task="${esc(t.id)}" style="left:calc(${x}% - 32px)"
              aria-label="${esc(`שלב ${k + 1}: ${kind.he}, ${s === 'done' ? 'הושלם' : s === 'now' ? 'עכשיו' : 'נעול'}`)}">
              ${s === 'done' ? icon('check') : s === 'now' ? icon(kind.ic) : icon('lock2')}
            </button>
            <div class="zz-label ${right ? 'to-left' : 'to-right'}" style="${right ? `right:calc(${100 - x}% + 44px)` : `left:calc(${x}% + 44px)`}">
              <span class="zz-name">${esc(kind.he)}${s === 'now' ? ' <span class="now-pill">עכשיו</span>' : ''}</span>
              <span class="zz-sub"><bdi dir="rtl">${esc(t.title_he || KIND_SUB[t.kind] || '')}</bdi></span>
              ${xpLine}
            </div>
          </li>`;
        }).join('')}
      </ol>

      ${allDone ? `<div class="card finish-card" data-testid="mission-finished"><span class="ico gold">${icon('trophy')}</span><div class="grow"><div class="bold">המשימה הושלמה!</div><div class="small muted">קיבלת בונוס של 50 XP. נתראה מחר.</div></div></div>` : ''}
      <p class="tiny muted center">שלב שכבר עשית אפשר לשחק שוב, בחצי XP.</p>
      <div class="action-bar">${allDone
        ? `<a class="btn block big" href="#home">${icon('home')} הביתה</a>`
        : `<button class="btn block big" data-next data-testid="mission-start">${done ? `המשך לשלב ${nextIdx + 1}` : 'מתחילים משלב 1'} ${icon('arrowL')}</button>`}</div>
    </div>
  </section>`;

  on(root, '[data-task]', 'click', (e, b) => {
    const k = tasks.findIndex((x) => x.id === b.dataset.task);
    const t = tasks[k];
    if (!t) return;
    if (status(t, k) === 'locked') {
      ctx.haptic([20, 30, 20]);
      ctx.toast(`קודם מסיימים את שלב ${nextIdx + 1}`, { kind: 'warn' });
      return;
    }
    ctx.haptic(10);
    ctx.startTask(t);
  });
  on(root, '[data-next]', 'click', () => { const t = ctx.nextTask(); if (t) ctx.startTask(t); });
}
