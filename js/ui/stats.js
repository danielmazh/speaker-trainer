// Stats: profile band with level ring and stat tiles, streak calendar (5 weeks),
// filler trend bars, mastery per skill, badges grid.
import { esc, ringSvg } from './dom.js';
import { icon } from './icons.js';
import { catMastery } from './shell.js';

const WD = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const BADGE_COLORS = ['#FF7A1A', '#6C3BF5', '#B26A00', '#22C55E', '#F04438', '#FFB020'];

function trendBars(vals) {
  const max = Math.max(1, ...vals);
  const W = 300, H = 76, n = vals.length, gap = 8;
  const bw = (W - gap * (n - 1)) / n;
  return `<svg class="trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="מילות מילוי לדקה, ${n} אימונים אחרונים: ${vals.join(', ')}">
    ${vals.map((v, i) => {
      const h = Math.max(6, (v / max) * (H - 4));
      const x = W - (i + 1) * bw - i * gap; // oldest at inline start (right in RTL)
      return `<rect x="${x.toFixed(1)}" y="${(H - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="6" class="${i === n - 1 ? 'last' : ''}"><title>${v}</title></rect>`;
    }).join('')}
  </svg>`;
}

export function render(root, ctx) {
  const st = ctx.state;
  const s = ctx.E.stats(st);
  const lv = ctx.level();
  const days = new Set(st.days || []);
  const today = ctx.E.todayStr();
  const name = (st.name || 'Daniel').trim() || 'Daniel';

  // 5 weeks: Sunday-start rows, last row holds today.
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - now.getDay()), 12);
  const cells = [];
  for (let k = 34; k >= 0; k--) {
    const d = new Date(end.getFullYear(), end.getMonth(), end.getDate() - k, 12);
    const ds = ctx.E.todayStr(d);
    cells.push({ ds, on: days.has(ds), today: ds === today, future: ds > today, n: d.getDate() });
  }
  const trend = s.fillersPerMinTrend || [];
  const delta = trend.length >= 2 && trend[0] > 0 ? Math.round(((trend[trend.length - 1] - trend[0]) / trend[0]) * 100) : null;
  const badges = ctx.C.BADGES || [];
  const have = new Set(st.badges || []);
  const cats = ctx.C.CATEGORIES || [];

  root.innerHTML = `<section class="screen stats">
    <header class="band">
      <div class="spread">
        <div class="row nowrap">
          <div class="avatar-ring">${ringSvg(lv.pct, { size: 64, stroke: 5, cls: 'on-band', label: `<span class="avatar sm">${esc(name[0].toUpperCase())}</span>` })}</div>
          <div class="grow"><h1 class="en">${esc(name)}</h1><p class="sub">רמה ${lv.level} - ${esc(lv.title_he)}</p></div>
        </div>
        <a class="icon-btn" href="#profile" aria-label="הגדרות">${icon('settings')}</a>
      </div>
      <div class="stat-tiles">
        <div class="stat-tile"><span class="sv"><b class="en-num">${s.avgScore}</b>${icon('target')}</span><span>ציון ממוצע</span></div>
        <div class="stat-tile"><span class="sv"><b class="en-num">${s.bestStreak}</b><span class="flame-ic">${icon('flameLine')}</span></span><span>שיא רצף</span></div>
        <div class="stat-tile"><span class="sv"><b class="en-num">${s.totalXp.toLocaleString('en-US')}</b><span class="gold-ic">${icon('starLine')}</span></span><span>XP</span></div>
      </div>
    </header>

    <div class="body">
      <div class="card stack-sm">
        <div class="card-head"><h2>${MONTHS[now.getMonth()]}</h2><span class="tag flame">${icon('flameLine')} <bdi>${st.streak.count || 0}</bdi> ימים</span></div>
        <div class="cal" role="grid" aria-label="ימי אימון ב-5 השבועות האחרונים">
          ${WD.map((w) => `<span class="cal-h" aria-hidden="true">${w}</span>`).join('')}
          ${cells.map((c) => `<span class="cal-d ${c.today ? 'today' : c.on ? 'on' : ''} ${c.future ? 'future' : ''}" role="gridcell" aria-label="${c.ds}${c.on ? ', התאמנת' : ''}${c.today ? ', היום' : ''}">${c.today ? icon('flameLine') : `<bdi class="en-num">${c.n}</bdi>`}</span>`).join('')}
        </div>
      </div>

      <div class="card stack-sm">
        <div class="card-head"><h2>מילוי לדקה - ${trend.length >= 2 ? `${trend.length} אימונים` : "מגמה"}</h2>${delta !== null ? `<span class="tag ${delta <= 0 ? 'good' : 'bad'}"><bdi>${delta > 0 ? '+' : ''}${delta}%</bdi> ${icon('trendDown')}</span>` : ''}</div>
        ${trend.length >= 2 ? trendBars(trend) : `<p class="small muted">עוד אין מספיק נתונים. סיים 2 משימות דיבור עם מיקרופון ותראה כאן את המגמה.</p>`}
      </div>

      <div class="card stack-sm">
        <div class="card-head"><h2>שליטה לפי כישור</h2><bdi class="tiny muted en-num">${s.mastered} mastered</bdi></div>
        <ul class="mastery">
          ${cats.map((c) => { const m = catMastery(st, ctx.C.ITEMS || [], c.id); const col = c.color && c.color !== '#1B1530' && c.color !== '#8A84A3' ? c.color : '#6C3BF5'; return `<li style="--c:${esc(col)}"><span class="m-ic">${icon(c.icon || c.id)}</span><span class="grow"><span class="spread small"><span>${esc(c.label_he)}</span><bdi class="muted en-num">${m.pct}%</bdi></span><span class="bar thin"><i style="--p:${m.pct}%"></i></span></span></li>`; }).join('')}
        </ul>
      </div>

      <div class="card stack-sm">
        <div class="card-head"><h2>תגים</h2><bdi class="tiny muted en-num">${have.size}/${badges.length}</bdi></div>
        <div class="badges">
          ${badges.map((b, k) => { const got = have.has(b.id); return `<div class="badge ${got ? 'got' : 'locked'}" tabindex="0" style="--bc:${BADGE_COLORS[k % BADGE_COLORS.length]}" aria-label="${esc(`${b.title_he}: ${b.desc_he}${got ? '' : ' (נעול)'}`)}" title="${esc(b.desc_he)}">
            <span class="medal">${icon(got ? (b.icon || 'medal') : 'lock2')}</span>
            <span class="b-name">${esc(b.title_he)}</span>
          </div>`; }).join('')}
        </div>
      </div>
    </div>
  </section>`;
}
