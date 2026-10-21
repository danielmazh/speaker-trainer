// Stats: profile band with 4 tiles, 30-day heatmap, one trend line with a toggle,
// accuracy by skill, weakest 3 skills with practice buttons, badges grid. SVG only, no libraries.
import { esc, ringSvg, on } from './dom.js';
import { icon } from './icons.js';
import { ic, catColor, profileOf } from './shell.js';

const BADGE_COLORS = ['#FF7A1A', '#6C3BF5', '#B26A00', '#22C55E', '#F04438', '#FFB020'];
const TRENDS = {
  fpm: { he: 'מילוי לדקה', key: 'fillersPerMinTrend', goodDown: true, goal: 1, goalHe: 'יעד: פחות ממילה אחת בדקה', empty: 'סיים 2 תרגילי דיבור עם מיקרופון ותראה כאן את המגמה.' },
  wpm: { he: 'קצב', key: 'wpmTrend', band: [110, 160], goalHe: 'טווח טוב: 110 עד 160', empty: 'דבר לתוך המיקרופון ונמדוד את הקצב שלך.' },
  score: { he: 'ציון', key: 'scoreTrend', goal: 80, goalHe: 'יעד: 80', empty: 'סיים 2 אימונים ותראה כאן את הציונים.' },
};
let trendKey = 'fpm';

const fmt = (n) => (n >= 10000 ? `${(n / 1000).toFixed(1)}k` : Math.round(n).toLocaleString('en-US'));

// 30 squares, 10 per row, oldest at the inline start (top right in RTL).
function heatmap(days, goal, today) {
  const cell = 26, gap = 4, cols = 10;
  const rows = Math.ceil(days.length / cols);
  const W = cols * cell + (cols - 1) * gap, H = rows * cell + (rows - 1) * gap;
  const lvl = (m) => (m <= 0 ? 0 : m < goal / 2 ? 1 : m < goal ? 2 : 3);
  return `<svg class="heat" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`פעילות ב-30 הימים האחרונים: ${days.filter((d) => d.min > 0).length} ימים עם אימון`)}">
    ${days.map((d, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      const x = W - (c + 1) * cell - c * gap, y = r * (cell + gap);
      return `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="7" class="h${lvl(d.min)}${d.date === today ? ' today' : ''}"><title>${d.date}: ${d.min} דק'</title></rect>`;
    }).join('')}
  </svg>`;
}

// One line, oldest on the inline start (right). Goal line or good band behind it.
function lineChart(vals, def) {
  const W = 300, H = 120, px = 12, pt = 14, pb = 14;
  const lo0 = Math.min(...vals, def.goal ?? Infinity, def.band ? def.band[0] : Infinity);
  const hi0 = Math.max(...vals, def.goal ?? -Infinity, def.band ? def.band[1] : -Infinity);
  const pad = (hi0 - lo0) * 0.12 || 1;
  const lo = Math.max(0, lo0 - pad), hi = hi0 + pad;
  const n = vals.length;
  const X = (i) => W - px - (n === 1 ? 0 : (i * (W - 2 * px)) / (n - 1));
  const Y = (v) => pt + (1 - (v - lo) / (hi - lo)) * (H - pt - pb);
  const pts = vals.map((v, i) => [X(i), Y(v)]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${line} L${pts[n - 1][0].toFixed(1)} ${H - pb} L${pts[0][0].toFixed(1)} ${H - pb} Z`;
  const [lx, ly] = pts[n - 1];
  const last = vals[n - 1];
  return `<svg class="tline" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`${def.he}, ${n} אימונים אחרונים: ${vals.join(', ')}`)}">
    ${def.band ? `<rect class="t-band" x="0" y="${Y(def.band[1]).toFixed(1)}" width="${W}" height="${(Y(def.band[0]) - Y(def.band[1])).toFixed(1)}" rx="6"/>` : ''}
    ${def.goal != null ? `<line class="t-goal" x1="0" x2="${W}" y1="${Y(def.goal).toFixed(1)}" y2="${Y(def.goal).toFixed(1)}"/>` : ''}
    <path class="t-area" d="${area}"/>
    <path class="t-line" d="${line}"/>
    ${pts.map(([x, y], i) => `<circle class="t-pt${i === n - 1 ? ' last' : ''}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${i === n - 1 ? 5 : 3}"><title>${vals[i]}</title></circle>`).join('')}
    <text class="t-val" x="${Math.min(W - 4, Math.max(20, lx)).toFixed(1)}" y="${Math.max(11, ly - 10).toFixed(1)}" text-anchor="middle">${last}</text>
  </svg>`;
}

export function render(root, ctx) {
  const st = ctx.state;
  const s = ctx.stats();
  const N = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const lv = ctx.level();
  const today = ctx.E.todayStr();
  const prof = profileOf(st);
  const name = String(prof.name || st.name || '').trim();
  const badges = ctx.C.BADGES || [];
  const have = new Set(st.badges || []);
  const acc = {};
  for (const [c, a] of Object.entries(s.accuracyByCat || {})) acc[c] = { avg: Math.round(N(a && a.avg)), count: Math.round(N(a && a.count)) };
  const accRows = Object.entries(acc).filter(([c, a]) => ctx.cat(c) && a.count > 0).sort((a, b) => b[1].avg - a[1].avg);
  const weakest = (s.weakest || []).filter((c) => ctx.cat(c)).slice(0, 3);
  const days = (s.minutesByDay || []).map((d) => ({ date: String(d && d.date).replace(/[^\d-]/g, ''), min: Math.round(N(d && d.min) * 10) / 10 }));
  const activeDays = days.filter((d) => d.min > 0).length;

  const tile = (val, label, ico, cls = '') => `<div class="stat-tile"><span class="sv"><b class="en-num">${val}</b><span class="${cls}">${icon(ico)}</span></span><span>${label}</span></div>`;

  root.innerHTML = `<section class="screen stats" data-testid="stats">
    <header class="band">
      <div class="spread">
        <div class="row nowrap">
          <div class="avatar-ring">${ringSvg(lv.pct, { size: 64, stroke: 5, cls: 'on-band', label: `<span class="avatar sm">${name ? esc(name[0].toUpperCase()) : icon('user')}</span>` })}</div>
          <div class="grow">${name ? `<h1 class="en">${esc(name)}</h1>` : '<h1>הפרופיל שלי</h1>'}<p class="sub">רמה ${lv.level} - ${esc(lv.title_he)}</p></div>
        </div>
        <a class="icon-btn" href="#profile" aria-label="פרופיל והגדרות">${icon('settings')}</a>
      </div>
      <div class="stat-tiles four">
        ${tile(fmt(N(s.minutesTotal)), 'דקות', 'timer')}
        ${tile(fmt(N(s.wordsSpoken)), 'מילים', 'message')}
        ${tile(Math.round(N(s.avgScore)), 'ציון ממוצע', 'target')}
        ${tile(N(st.streak.count), 'רצף', 'flameLine', 'flame-ic')}
      </div>
    </header>

    <div class="body">
      <div class="card stack-sm">
        <div class="card-head"><h2>30 ימים אחרונים</h2><span class="tag flame">${icon('flameLine')} <bdi>${activeDays}</bdi> ימים פעילים</span></div>
        ${heatmap(days, prof.dailyGoalMin, today)}
        <div class="heat-key tiny muted" aria-hidden="true"><span>פחות</span><i class="h0"></i><i class="h1"></i><i class="h2"></i><i class="h3"></i><span>יותר</span><span class="grow"></span><span>יעד: <bdi>${prof.dailyGoalMin}</bdi> דק' ביום</span></div>
      </div>

      <div class="card stack-sm" data-testid="trend">
        <div class="seg sm-seg" role="group" aria-label="איזו מגמה להציג">
          ${Object.entries(TRENDS).map(([k, d]) => `<button data-trend="${k}" aria-pressed="${k === trendKey}">${d.he}</button>`).join('')}
        </div>
        <div data-trend-body></div>
      </div>

      <div class="card stack-sm">
        <div class="card-head"><h2>דיוק לפי כישור</h2><bdi class="tiny muted en-num">${N(s.mastered)} mastered</bdi></div>
        ${accRows.length ? `<ul class="mastery">
          ${accRows.map(([c, a]) => { const cat = ctx.cat(c); return `<li style="--c:${esc(catColor(cat))}"><span class="m-ic">${ic(cat.icon, cat.id)}</span><span class="grow"><span class="spread small"><span>${esc(cat.label_he)}</span><span class="muted"><bdi class="en-num">${a.avg}%</bdi> <span class="tiny">(<bdi>${a.count}</bdi>)</span></span></span><span class="bar thin"><i style="--p:${a.avg}%"></i></span></span></li>`; }).join('')}
        </ul>` : '<p class="small muted">עוד אין נתונים. כל תרגיל שתעשה יופיע כאן.</p>'}
      </div>

      ${weakest.length ? `<div class="card stack-sm" data-testid="weakest">
        <div class="card-head"><h2>כדאי לחזק</h2><span class="tiny muted">3 הכישורים החלשים</span></div>
        <ul class="weak-list">
          ${weakest.map((c) => { const cat = ctx.cat(c); const a = acc[c] || { avg: 0 }; return `<li style="--c:${esc(catColor(cat))}">
            <span class="m-ic">${ic(cat.icon, cat.id)}</span>
            <span class="grow"><span class="bold small d-block">${esc(cat.label_he)}</span><span class="tiny muted">ממוצע <bdi>${a.avg}%</bdi></span></span>
            <button class="btn sm ghost" data-practice="${esc(c)}">${icon('target')} תרגל</button>
          </li>`; }).join('')}
        </ul>
      </div>` : ''}

      <div class="card stack-sm">
        <div class="card-head"><h2>תגים</h2><bdi class="tiny muted en-num">${have.size}/${badges.length}</bdi></div>
        <div class="badges">
          ${badges.map((b, k) => { const got = have.has(b.id); return `<div class="badge ${got ? 'got' : 'locked'}" tabindex="0" style="--bc:${BADGE_COLORS[k % BADGE_COLORS.length]}" aria-label="${esc(`${b.title_he}: ${b.desc_he}${got ? '' : ' (נעול)'}`)}" title="${esc(b.desc_he)}">
            <span class="medal">${got ? ic(b.icon, 'medal') : icon('lock2')}</span>
            <span class="b-name">${esc(b.title_he)}</span>
          </div>`; }).join('')}
        </div>
      </div>
    </div>
  </section>`;

  const drawTrend = () => {
    const d = TRENDS[trendKey];
    const vals = (s[d.key] || []).map((v) => Math.round(Number(v) * 10) / 10).filter((v) => Number.isFinite(v));
    const host = root.querySelector('[data-trend-body]');
    if (vals.length < 2) {
      host.innerHTML = `<p class="small muted trend-empty">${esc(d.empty)}</p>`;
      return;
    }
    const first = vals[0], last = vals[vals.length - 1];
    const delta = first ? Math.round(((last - first) / first) * 100) : null;
    const better = delta === null ? null : d.goodDown ? delta <= 0 : d.band ? Math.abs(last - 135) <= Math.abs(first - 135) : delta >= 0;
    host.innerHTML = `<div class="card-head"><h2>${esc(d.he)} - <bdi>${vals.length}</bdi> אימונים</h2>${delta !== null ? `<span class="tag ${better ? 'good' : 'bad'}"><bdi>${delta > 0 ? '+' : ''}${delta}%</bdi></span>` : ''}</div>
      ${lineChart(vals, d)}
      <div class="trend-key tiny muted"><span>${esc(d.goalHe)}</span><span>${icon('arrowL')} עכשיו</span></div>`;
  };
  drawTrend();

  on(root, '[data-trend]', 'click', (e, b) => {
    trendKey = b.dataset.trend;
    root.querySelectorAll('[data-trend]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    ctx.haptic(8);
    drawTrend();
  });
  on(root, '[data-practice]', 'click', (e, b) => {
    const c = ctx.cat(b.dataset.practice);
    ctx.startPractice({ title_he: `תרגול: ${c ? c.label_he : ''}`, itemIds: ctx.pickForCat(b.dataset.practice, 4) });
  });
}
