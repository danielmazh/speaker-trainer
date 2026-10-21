// Home: greeting band with streak and level card, today's mission card, category chips, skills.
import { esc, ringSvg, on } from './dom.js';
import { icon } from './icons.js';
import { catMastery, greeting, catColor, ic, rememberTrack, profileOf, daysUntil } from './shell.js';

let filter = 'all';

// Stored state is untrusted: numbers only.
function num(v, dflt = 0) { const n = Number(v); return Number.isFinite(n) ? n : dflt; }

export function render(root, ctx) {
  const st = ctx.state;
  const lv0 = ctx.level();
  const lv = { ...lv0, level: Number(lv0.level) || 1, cur: Number(lv0.cur) || 0, next: Number(lv0.next) || 0, pct: Number(lv0.pct) || 0 };
  const d = st.daily;
  const total = num(d.tasks.length, 5) || 5;
  const done = num(d.done.length);
  const allDone = done >= total && total > 0;
  const next = ctx.nextTask();
  const minutes = d.tasks.reduce((a, t) => a + num(t.minutes, 2), 0);
  const xpLeft = d.tasks.filter((t) => !d.done.includes(t.id)).reduce((a, t) => a + num(t.xp), 0) + (d.bonus ? 0 : 50);
  const name = (st.name || 'Daniel').trim() || 'Daniel';
  const streak = num(st.streak.count);
  const streakAlive = st.streak.last === ctx.E.todayStr();
  const cats = ctx.C.CATEGORIES || [];
  const items = ctx.C.ITEMS || [];
  const prof = profileOf(st);
  const sx = ctx.stats();
  const todayMin = Math.round(Number(sx.todayMin) || 0);
  const goal = prof.dailyGoalMin;
  const goalPct = Math.min(100, Number.isFinite(sx.goalPct) ? sx.goalPct : Math.round((todayMin / goal) * 100));
  const talkIn = daysUntil(prof.nextTalkDate, ctx.E.todayStr());

  // Continue your path: first focus track with an open unit, else the track with most progress.
  const tracks = ctx.tracks();
  const tp = ctx.trackProgress();
  const open = tracks.filter((t) => tp[t.id] && tp[t.id].currentUnitId);
  const focus = open.filter((t) => prof.focusTracks.includes(t.id));
  const cont = focus[0] || [...open].sort((a, b) => (tp[b.id].pct || 0) - (tp[a.id].pct || 0))[0] || null;
  const contUnit = cont ? (cont.units || []).find((u) => u.id === tp[cont.id].currentUnitId) : null;

  root.innerHTML = `<section class="screen home">
    <header class="band">
      <div class="spread">
        <div class="row nowrap">
          <a class="avatar" href="#profile" aria-label="פרופיל והגדרות">${esc(name[0].toUpperCase())}</a>
          <div class="grow">
            <h1 class="greet">היי <bdi>${esc(name)}</bdi></h1>
            <p class="sub">${esc(greeting())}</p>
          </div>
        </div>
        <a class="band-pill ${streakAlive ? 'alive' : ''}" href="#stats" aria-label="רצף: ${streak} ימים"><span class="flame-ic">${icon('flameLine')}</span><span class="en-num">${streak}</span></a>
      </div>
      <a class="level-card" href="#stats" aria-label="רמה ${lv.level}, ${lv.cur} מתוך ${lv.next} XP">
        ${ringSvg(lv.pct, { size: 56, stroke: 9, cls: 'on-band', label: `<b class="lv-n en-num">${lv.level}</b>` })}
        <div class="grow">
          <div class="spread"><span class="lv-title">רמה ${lv.level} - ${esc(lv.title_he)}</span><bdi class="xp-num en-num">${lv.cur} / ${lv.next} XP</bdi></div>
          <div class="bar on-band"><i style="--p:${lv.pct}%"></i></div>
          <div class="lv-hint">עוד <bdi>${lv.next - lv.cur} XP</bdi> לרמה ${lv.level + 1}</div>
        </div>
      </a>
    </header>

    <div class="body">
      <article class="card hero ${allDone ? 'done' : ''}">
        <div class="hero-top">
          <div class="grow stack-xs">
            <span class="tag">${icon('calendar')} המשימה של היום</span>
            <h2 class="en hero-title">${allDone ? 'Mission complete!' : "Today's mission"}</h2>
            <div class="hero-meta"><span>${icon('listChecks')} ${total} שלבים</span><span>${icon('timer')} <bdi>${minutes}</bdi> דק'</span></div>
          </div>
          ${allDone
            ? `<a class="go-btn done" href="#mission" aria-label="המשימה הושלמה. למפה">${icon('check')}</a>`
            : `<button class="go-btn" data-start aria-label="${done ? 'המשך את המשימה' : 'התחל את המשימה'}">${icon('play')}</button>`}
        </div>
        <a class="hero-segs" href="#mission" aria-label="מפת המשימה: ${done} מתוך ${total} הושלמו">
          ${d.tasks.map((t) => `<i class="${d.done.includes(t.id) ? 'done' : next && next.id === t.id ? 'now' : ''}"></i>`).join('')}
        </a>
        <div class="spread hero-foot">
          <span>${done} מתוך ${total} הושלמו</span>
          ${allDone ? '<span class="good-ink">נתראה מחר</span>' : `<bdi class="xp-gold en-num">+${xpLeft} XP</bdi>`}
        </div>
      </article>

      ${cont && contUnit ? `<button class="card cont-card" data-cont="${esc(cont.id)}" style="--c:${esc(catColor(cont))}" data-testid="continue-path">
        <span class="track-ico">${ic(cont.icon, cont.id.replace(/^t-/, ''))}</span>
        <span class="grow stack-xs">
          <span class="tiny muted">${tp[cont.id].unitsDone ? 'המשך במסלול' : 'התחל מסלול'} - ${esc(cont.title_he)}</span>
          <span class="bold">${esc(contUnit.title_he)}</span>
          <span class="bar thin"><i style="--p:${Math.max(tp[cont.id].pct, 3)}%"></i></span>
        </span>
        <span class="go-btn sm" aria-hidden="true">${icon('play')}</span>
      </button>` : ''}

      <div class="mini-grid">
        <a class="card mini goal-tile" href="#stats" aria-label="יעד יומי: ${todayMin} מתוך ${goal} דקות" data-testid="goal-ring">
          ${ringSvg(goalPct, { size: 52, stroke: 7, color: goalPct >= 100 ? 'var(--good)' : '', label: goalPct >= 100 ? `<span class="good-ink">${icon('check')}</span>` : `<b class="en-num ring-pct">${todayMin}</b>` })}
          <span class="stack-xs grow"><span class="bold small">יעד יומי</span><span class="tiny muted"><bdi>${todayMin}/${goal}</bdi> דק'</span></span>
        </a>
        <a class="card mini" href="#coach" data-testid="coach-tile">
          <span class="ico">${icon('sparkles')}</span>
          <span class="stack-xs grow"><span class="bold small">המאמן</span><span class="tiny muted">${talkIn !== null && talkIn >= 0 ? (talkIn === 0 ? 'ההרצאה היום!' : `עוד <bdi>${talkIn}</bdi> ימים להרצאה`) : 'הכנה להרצאה'}</span></span>
        </a>
      </div>

      <div class="chips" role="group" aria-label="סינון לפי קטגוריה">
        <button class="chip" aria-pressed="${filter === 'all'}" data-f="all">הכל</button>
        ${cats.map((c) => `<button class="chip" aria-pressed="${filter === c.id}" data-f="${esc(c.id)}"><bdi>${esc(c.label_he)}</bdi></button>`).join('')}
      </div>

      <div>
        <div class="section-head"><h2>הכישורים שלך</h2><a href="#stats">הכל</a></div>
        <div class="skills" id="skills"></div>
      </div>
    </div>
  </section>`;

  const drawSkills = () => {
    const list = filter === 'all' ? cats : cats.filter((c) => c.id === filter);
    root.querySelector('#skills').innerHTML = list.map((c) => {
      const m = catMastery(st, items, c.id);
      const col = catColor(c);
      return `<button class="skill" data-cat="${esc(c.id)}" style="--c:${esc(col)}" aria-label="${esc(`תרגל ${c.label_he}. נשלט ${m.pct}%`)}">
        <span class="skill-top"><span class="skill-ico">${ic(c.icon, c.id)}</span><bdi class="skill-count en-num">${m.seen}/${m.count}</bdi></span>
        <span class="skill-name"><bdi>${esc(c.label_he)}</bdi></span>
        <span class="bar thin"><i style="--p:${Math.max(m.pct, m.seen ? 4 : 0)}%"></i></span>
      </button>`;
    }).join('');
  };
  drawSkills();

  on(root, '[data-f]', 'click', (e, b) => {
    filter = b.dataset.f;
    root.querySelectorAll('[data-f]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    ctx.haptic(8);
    drawSkills();
  });
  on(root, '[data-start]', 'click', () => {
    const t = ctx.nextTask();
    if (t) ctx.startTask(t);
  });
  on(root, '[data-cont]', 'click', (e, b) => {
    rememberTrack(b.dataset.cont);
    ctx.session.trackId = b.dataset.cont;
    ctx.go('track');
  });
  on(root, '[data-cat]', 'click', (e, b) => {
    const c = ctx.cat(b.dataset.cat);
    ctx.startPractice({ title_he: `תרגול: ${c ? c.label_he : ''}`, itemIds: ctx.pickForCat(b.dataset.cat, 4) });
  });
}
