// Path: two tabs. "מסלולים": all tracks as compact rows with a progress ring, focus tracks first.
// "נושאים": every topic as a card that starts a short free practice. Coach is a chip in the band.
import { esc, ringSvg, on } from './dom.js';
import { icon } from './icons.js';
import { band, ic, catColor, catMastery, rememberTrack, profileOf } from './shell.js';

let tab = 'tracks';

export function render(root, ctx) {
  if (ctx.session.pathTab) { tab = ctx.session.pathTab; ctx.session.pathTab = null; }
  const tracks = ctx.tracks();
  const prog = ctx.trackProgress();
  const focus = new Set(profileOf(ctx.state).focusTracks);
  const list = [...tracks].sort((a, b) => (focus.has(b.id) ? 1 : 0) - (focus.has(a.id) ? 1 : 0));
  const done = Object.values(prog).reduce((a, p) => a + (Number(p.unitsDone) || 0), 0);
  const total = Object.values(prog).reduce((a, p) => a + (Number(p.unitsTotal) || 0), 0);
  const cats = ctx.C.CATEGORIES || [];
  const items = ctx.C.ITEMS || [];
  const st = ctx.state;

  root.innerHTML = `<section class="screen path" data-testid="path">
    ${band({
      title: 'המסלול שלך',
      right: `<span class="band-pill" aria-label="${done} מתוך ${total} יחידות הושלמו"><bdi class="en-num">${done}/${total}</bdi><span class="gold-ic">${icon('crown')}</span></span>
        <a class="band-pill" href="#coach" data-testid="coach-link" aria-label="המאמן: הכנה להרצאה"><span class="gold-ic">${icon('sparkles')}</span>מאמן</a>`,
    }).replace('class="band"', 'class="band compact"')}
    <div class="body">
      <div class="seg tabs" role="group" aria-label="מה להציג">
        <button data-tab="tracks" aria-pressed="${tab === 'tracks'}">מסלולים</button>
        <button data-tab="topics" aria-pressed="${tab === 'topics'}">נושאים</button>
      </div>

      <div data-panel="tracks" ${tab === 'tracks' ? '' : 'hidden'}>
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
              <span class="track-meta">${complete ? `<span class="good-ink">${icon('check')} הושלם</span>` : `יחידה <bdi>${Math.min(p.unitsDone + 1, p.unitsTotal)}</bdi> מתוך <bdi>${p.unitsTotal}</bdi>`}</span>
            </span>
            ${ringSvg(p.pct, { size: 40, stroke: 5, color: col, label: `<b class="en-num ring-pct">${p.pct}</b>` })}
          </button></li>`;
        }).join('')}
      </ul>` : `<div class="card empty">המסלולים בדרך. בינתיים יש את המשימה היומית.</div>`}
      </div>

      <div data-panel="topics" ${tab === 'topics' ? '' : 'hidden'}>
        <p class="tiny muted topics-hint">הקש על נושא לתרגול קצר של 4 תרגילים.</p>
        <div class="skills">
          ${cats.map((c) => {
            const m = catMastery(st, items, c.id);
            const col = catColor(c);
            return `<button class="skill" data-cat="${esc(c.id)}" style="--c:${esc(col)}" aria-label="${esc(`תרגל ${c.label_he}. נשלט ${m.pct}%`)}">
              <span class="skill-top"><span class="skill-ico">${ic(c.icon, c.id)}</span><bdi class="skill-count en-num">${m.seen}/${m.count}</bdi></span>
              <span class="skill-name"><bdi>${esc(c.label_he)}</bdi></span>
              <span class="bar thin"><i style="--p:${Math.max(m.pct, m.seen ? 4 : 0)}%"></i></span>
            </button>`;
          }).join('')}
        </div>
      </div>
    </div>
  </section>`;

  on(root, '[data-tab]', 'click', (e, b) => {
    tab = b.dataset.tab;
    root.querySelectorAll('[data-tab]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    root.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== tab; });
    ctx.haptic(8);
  });
  on(root, '[data-track]', 'click', (e, b) => {
    rememberTrack(b.dataset.track);
    ctx.session.trackId = b.dataset.track;
    ctx.haptic(8);
    ctx.go('track');
  });
  on(root, '[data-cat]', 'click', (e, b) => {
    const c = ctx.cat(b.dataset.cat);
    ctx.startPractice({ title_he: `תרגול: ${c ? c.label_he : ''}`, itemIds: ctx.pickForCat(b.dataset.cat, 4) });
  });
}
