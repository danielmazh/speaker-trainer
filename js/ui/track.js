// Track: the units of one track as a vertical zigzag path (like the mission map).
// Each unit ends with a boss item. The last node is the track trophy.
import { esc, on } from './dom.js';
import { icon } from './icons.js';
import { ic, catColor, rememberedTrack, TYPE_HE } from './shell.js';

const XS = [72, 30, 68, 28, 66, 32];
const STEP = 84;
const TOP = 40;

export function render(root, ctx) {
  const id = ctx.session.trackId || rememberedTrack();
  const track = ctx.track(id) || ctx.tracks()[0];
  if (!track) { ctx.go('path'); return; }
  ctx.session.trackId = track.id;
  const p = ctx.trackProgress()[track.id] || { pct: 0, unitsDone: 0, unitsTotal: 0, units: {} };
  const units = track.units || [];
  // Stored state is untrusted: keep only booleans and numbers from it.
  const tstate = {};
  for (const [k, v] of Object.entries(ctx.state.tracks || {})) tstate[k] = { bossPassed: !!(v && v.bossPassed === true), bestScore: Math.round(Number(v && v.bestScore) || 0) };
  const col = catColor(track);
  const allDone = p.unitsTotal > 0 && p.unitsDone === p.unitsTotal;
  const nodes = [...units.map((u) => ({ u, s: (p.units[u.id] || {}).status || 'locked' })), { trophy: true, s: allDone ? 'done' : 'locked' }];
  const xAt = (k) => XS[k % XS.length];

  let dots = '';
  for (let k = 0; k < nodes.length - 1; k++) {
    const x1 = xAt(k), x2 = xAt(k + 1), y1 = TOP + k * STEP, y2 = TOP + (k + 1) * STEP;
    const lit = nodes[k].s === 'done';
    for (let j = 1; j <= 8; j++) {
      const f = 0.14 + (j - 1) * (0.72 / 7);
      dots += `<i class="dot ${lit ? 'on' : ''}" style="left:${(x1 + (x2 - x1) * f).toFixed(2)}%;top:${(y1 + (y2 - y1) * f).toFixed(1)}px"></i>`;
    }
  }

  const label = (n, k) => {
    const x = xAt(k);
    const side = x > 50 ? `right:calc(${100 - x}% + 44px)` : `left:calc(${x}% + 44px)`;
    const cls = x > 50 ? 'to-left' : 'to-right';
    if (n.trophy) {
      return `<div class="zz-label ${cls}" style="${side}"><span class="zz-name">סיום המסלול</span><span class="zz-sub">${allDone ? 'כל הכבוד! סיימת את כל היחידות.' : 'סיים את כל היחידות'}</span></div>`;
    }
    const u = n.u;
    const up = p.units[u.id] || { pct: 0 };
    const boss = ctx.item(u.bossId);
    const bossOk = !!(tstate[u.id] && tstate[u.id].bossPassed) || n.s === 'done';
    const meta = n.s === 'done'
      ? `<span class="xp-line good-ink">הושלם${tstate[u.id] && tstate[u.id].bestScore ? ` <bdi>${tstate[u.id].bestScore}%</bdi>` : ''}</span>`
      : n.s === 'open'
        ? `<span class="xp-line xp-gold">${up.pct ? `<bdi>${up.pct}%</bdi> - ` : ''}<bdi>${(u.itemIds || []).length}</bdi> תרגילים${boss ? ' + בוס' : ''}</span>`
        : '';
    return `<div class="zz-label ${cls}" style="${side}">
      <span class="zz-name">${esc(u.title_he)}${n.s === 'open' ? ' <span class="now-pill">עכשיו</span>' : ''}</span>
      ${meta}
      ${boss && n.s !== 'locked' ? `<span class="boss-line ${bossOk ? 'ok' : ''}">${icon('crown')} בוס: ${esc(TYPE_HE[boss.type] || '')}${bossOk ? ' - עבר' : ''}</span>` : ''}
    </div>`;
  };

  const curUnit = p.currentUnitId ? units.find((u) => u.id === p.currentUnitId) : null;
  const curNo = curUnit ? units.indexOf(curUnit) + 1 : 0;
  root.innerHTML = `<section class="screen mission track" data-testid="track" style="--c:${esc(col)}">
    <header class="band compact">
      <div class="band-title">
        <a class="icon-btn" href="#path" aria-label="חזרה למסלולים">${icon('arrowR')}</a>
        <div class="grow"><h1>${esc(track.title_he)}</h1>
          <div class="row nowrap prog-row"><div class="bar on-band thin grow"><i style="--p:${p.pct}%"></i></div><bdi class="en-num tiny bold">${p.unitsDone}/${p.unitsTotal}</bdi></div>
        </div>
        <span class="band-ico" aria-hidden="true">${ic(track.icon, track.id.replace(/^t-/, ''))}</span>
      </div>
    </header>

    <div class="body">
      <ol class="zz" style="height:${TOP + (nodes.length - 1) * STEP + 72}px" aria-label="יחידות במסלול">
        ${dots}
        ${nodes.map((n, k) => `<li class="zz-node ${n.s === 'open' ? 'now' : n.s} ${n.trophy ? 'trophy' : ''}" style="top:${TOP + k * STEP - 32}px">
          ${n.trophy
            ? `<span class="zz-dot" style="left:calc(${xAt(k)}% - 32px)" aria-label="${allDone ? 'המסלול הושלם' : 'סיום המסלול, נעול'}" role="img">${icon('trophy')}</span>`
            : `<button class="zz-dot" data-unit="${esc(n.u.id)}" style="left:calc(${xAt(k)}% - 32px)"
                aria-label="${esc(`יחידה ${k + 1}: ${n.u.title_he}, ${n.s === 'done' ? 'הושלמה' : n.s === 'open' ? 'פתוחה' : 'נעולה'}`)}">
                ${n.s === 'done' ? icon('check') : n.s === 'open' ? `<bdi class="en-num unit-n">${k + 1}</bdi>` : icon('lock2')}
                <span class="crown-chip ${(tstate[n.u.id] && tstate[n.u.id].bossPassed) || n.s === 'done' ? 'ok' : ''}" aria-hidden="true">${icon('crown')}</span>
              </button>`}
          ${label(n, k)}
        </li>`).join('')}
      </ol>
      <p class="tiny muted center">יחידה נפתחת אחרי שכל התרגילים בקודמת עברו 70, כולל הבוס.</p>
      ${curUnit ? `<div class="action-bar"><button class="btn block big" data-go="${esc(curUnit.id)}" data-testid="track-continue">${p.unitsDone || (p.units[curUnit.id] || {}).pct ? 'המשך' : 'התחל'} יחידה <bdi>${curNo}</bdi> ${icon('arrowL')}</button></div>` : ''}
    </div>
  </section>`;

  const openSheet = (u) => {
    const s = (p.units[u.id] || {}).status || 'locked';
    if (s === 'locked') {
      ctx.haptic([20, 30, 20]);
      ctx.toast('קודם מסיימים את היחידה הקודמת', { kind: 'warn' });
      return;
    }
    const boss = ctx.item(u.bossId);
    const types = {};
    for (const iid of u.itemIds || []) { const it = ctx.item(iid); if (it && iid !== u.bossId) types[it.type] = (types[it.type] || 0) + 1; }
    const best = tstate[u.id] && tstate[u.id].bestScore;
    const m = ctx.modal(`
      <div class="unit-sheet">
        <span class="ico big-ico" style="--c:${esc(col)}">${ic(track.icon, track.id.replace(/^t-/, ''))}</span>
        <h2>${esc(u.title_he)}</h2>
        ${u.goal_he ? `<p class="muted small">${esc(u.goal_he)}</p>` : ''}
        <div class="unit-types">${Object.entries(types).map(([t, n]) => `<span class="tag">${icon(t)} ${esc(TYPE_HE[t] || t)} <bdi>${n}</bdi></span>`).join('')}
          ${boss ? `<span class="tag gold">${icon('crown')} בוס: ${esc(TYPE_HE[boss.type] || '')}</span>` : ''}</div>
        ${best ? `<p class="tiny muted">הציון הכי טוב: <bdi>${best}%</bdi></p>` : ''}
        <button class="btn block big" data-start>${s === 'done' ? 'לתרגל שוב' : 'התחל יחידה'} ${icon('arrowL')}</button>
        <button class="link-btn" data-cancel>לא עכשיו</button>
      </div>`, { sheet: true, label: u.title_he });
    m.el.querySelector('[data-start]').addEventListener('click', () => { m.close(); ctx.startUnit(track, u); });
    m.el.querySelector('[data-cancel]').addEventListener('click', m.close);
    m.el.querySelector('[data-start]').focus();
  };

  on(root, '[data-unit]', 'click', (e, b) => {
    const u = units.find((x) => x.id === b.dataset.unit);
    if (u) { ctx.haptic(10); openSheet(u); }
  });
  // The sticky button starts the current unit at once (2 taps from Path: track row, then this).
  on(root, '[data-go]', 'click', (e, b) => {
    const u = units.find((x) => x.id === b.dataset.go);
    if (u) { ctx.haptic(10); ctx.startUnit(track, u); }
  });
}
