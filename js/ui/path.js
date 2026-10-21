// Path: all skill tracks with a progress ring, focus tracks first. Coach lives here too.
import { esc, ringSvg, on } from './dom.js';
import { icon } from './icons.js';
import { band, ic, catColor, rememberTrack, profileOf } from './shell.js';

export function render(root, ctx) {
  const tracks = ctx.tracks();
  const prog = ctx.trackProgress();
  const focus = new Set(profileOf(ctx.state).focusTracks);
  const list = [...tracks].sort((a, b) => (focus.has(b.id) ? 1 : 0) - (focus.has(a.id) ? 1 : 0));
  const done = Object.values(prog).reduce((a, p) => a + (Number(p.unitsDone) || 0), 0);
  const total = Object.values(prog).reduce((a, p) => a + (Number(p.unitsTotal) || 0), 0);

  root.innerHTML = `<section class="screen path" data-testid="path">
    ${band({
      title: 'המסלול שלך',
      sub: 'כישורים לעבודה באנגלית, יחידה אחרי יחידה.',
      right: `<span class="band-pill" aria-label="${done} מתוך ${total} יחידות הושלמו"><bdi class="en-num">${done}/${total}</bdi><span class="gold-ic">${icon('crown')}</span></span>`,
    })}
    <div class="body">
      <a class="card coach-card" href="#coach" data-testid="coach-link">
        <span class="ico">${icon('sparkles')}</span>
        <span class="grow"><span class="bold">המאמן</span><span class="small muted d-block">הכנה מהירה לפני הרצאה: קהל, פתיח וטיפים.</span></span>
        <span class="chev-l">${icon('chevL')}</span>
      </a>

      <div class="section-head"><h2>מסלולים</h2><span class="tiny muted"><bdi>${tracks.length}</bdi> מסלולים</span></div>
      ${list.length ? `<ul class="tracks">
        ${list.map((t) => {
          const p0 = prog[t.id] || {};
          const p = { pct: Math.round(Number(p0.pct) || 0), unitsDone: Number(p0.unitsDone) || 0, unitsTotal: Number(p0.unitsTotal) || (t.units || []).length };
          const col = catColor(t);
          const complete = p.unitsTotal && p.unitsDone === p.unitsTotal;
          return `<li><button class="track-card" data-track="${esc(t.id)}" style="--c:${esc(col)}" aria-label="${esc(`${t.title_he}. ${p.unitsDone} מתוך ${p.unitsTotal} יחידות`)}">
            <span class="track-ico">${ic(t.icon, t.id.replace(/^t-/, ''))}</span>
            <span class="grow track-text">
              <span class="track-title">${esc(t.title_he)}${focus.has(t.id) ? ' <span class="tag">בפוקוס</span>' : ''}</span>
              <span class="track-desc">${esc(t.desc_he || '')}</span>
              <span class="track-meta">${complete ? `<span class="good-ink">${icon('check')} הושלם</span>` : `יחידה <bdi>${Math.min(p.unitsDone + 1, p.unitsTotal)}</bdi> מתוך <bdi>${p.unitsTotal}</bdi>`}</span>
            </span>
            ${ringSvg(p.pct, { size: 48, stroke: 6, color: col, label: `<b class="en-num ring-pct">${p.pct}%</b>` })}
          </button></li>`;
        }).join('')}
      </ul>` : `<div class="card empty">המסלולים בדרך. בינתיים יש את המשימה היומית.</div>`}
    </div>
  </section>`;

  on(root, '[data-track]', 'click', (e, b) => {
    rememberTrack(b.dataset.track);
    ctx.session.trackId = b.dataset.track;
    ctx.haptic(8);
    ctx.go('track');
  });
}
