// Home: one screen. Greeting row with level and streak, the mission hero card (one clear start button),
// one "continue your path" row, the daily goal and the coach. Topics live on the Path screen.
import { esc, ringSvg, on } from './dom.js';
import { icon } from './icons.js';
import { greeting, catColor, ic, rememberTrack, profileOf, daysUntil } from './shell.js';

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
  const name = String(st.name || '').trim();
  const today = ctx.E.todayStr();
  const streak = ctx.E.currentStreak(st);
  const streakAlive = st.streak.last === today;
  const prof = profileOf(st);
  const sx = ctx.stats();
  const todayMin = Math.round(Number(sx.todayMin) || 0);
  const goal = prof.dailyGoalMin;
  const goalPct = Math.min(100, Number.isFinite(sx.goalPct) ? sx.goalPct : Math.round((todayMin / goal) * 100));
  const talkIn = daysUntil(prof.nextTalkDate, today);

  // Continue your path: first focus track with an open unit, else the track with most progress.
  const tracks = ctx.tracks();
  const tp = ctx.trackProgress();
  const open = tracks.filter((t) => tp[t.id] && tp[t.id].currentUnitId);
  const focus = open.filter((t) => prof.focusTracks.includes(t.id));
  const cont = focus[0] || [...open].sort((a, b) => (tp[b.id].pct || 0) - (tp[a.id].pct || 0))[0] || null;
  const contUnit = cont ? (cont.units || []).find((u) => u.id === tp[cont.id].currentUnitId) : null;
  const contNo = cont && contUnit ? (cont.units || []).indexOf(contUnit) + 1 : 0;

  root.innerHTML = `<section class="screen home">
    <header class="band home-band">
      <div class="row nowrap greet-row">
        <a class="avatar" href="#profile" aria-label="פרופיל והגדרות">${name ? esc(name[0].toUpperCase()) : icon('user')}</a>
        <div class="grow">
          <h1 class="greet" data-testid="greet">${name ? `היי, <bdi>${esc(name)}</bdi>` : 'היי!'}</h1>
          <p class="sub">${esc(greeting())}</p>
        </div>
        <a class="band-pill ${streakAlive ? 'alive' : ''}" href="#stats" aria-label="רצף: ${streak} ימים"><span class="flame-ic">${icon('flameLine')}</span><span class="en-num">${streak}</span></a>
      </div>
      <a class="level-line" href="#stats" aria-label="רמה ${lv.level}, ${lv.cur} מתוך ${lv.next} XP">
        <span class="spread"><span class="lv-title">רמה <bdi>${lv.level}</bdi> - ${esc(lv.title_he)}</span><bdi class="xp-num en-num">${lv.cur} / ${lv.next} XP</bdi></span>
        <span class="bar on-band thin"><i style="--p:${lv.pct}%"></i></span>
      </a>
    </header>

    <div class="body">
      <article class="card hero ${allDone ? 'done' : ''}" data-testid="mission-hero">
        <a class="hero-link" href="#mission" aria-label="מפת המשימה: ${done} מתוך ${total} הושלמו"></a>
        <div class="hero-top">
          <div class="grow stack-xs">
            <h2 class="hero-title">${allDone ? 'המשימה הושלמה!' : 'המשימה של היום'}</h2>
            <div class="hero-meta"><span>${icon('listChecks')} ${total} שלבים</span><span>${icon('timer')} <bdi>${minutes}</bdi> דק'</span>${allDone ? '' : `<bdi class="xp-gold en-num">+${xpLeft} XP</bdi>`}</div>
          </div>
          ${allDone
            ? `<span class="go-btn done" aria-hidden="true">${icon('check')}</span>`
            : `<button class="go-btn" data-start data-testid="hero-start" aria-label="${done ? 'המשך את המשימה' : 'התחל את המשימה'}">${icon('play')}</button>`}
        </div>
        <div class="hero-segs" aria-hidden="true">
          ${d.tasks.map((t) => `<i class="${d.done.includes(t.id) ? 'done' : next && next.id === t.id ? 'now' : ''}"></i>`).join('')}
        </div>
        <div class="spread hero-foot">
          <span>${done} מתוך ${total} הושלמו</span>
          <span class="${allDone ? 'good-ink' : 'muted'}">${allDone ? 'נתראה מחר' : `למפה ${icon('chevL')}`}</span>
        </div>
      </article>

      ${cont && contUnit ? `<button class="card cont-card" data-cont="${esc(cont.id)}" style="--c:${esc(catColor(cont))}" data-testid="continue-path">
        <span class="track-ico">${ic(cont.icon, cont.id.replace(/^t-/, ''))}</span>
        <span class="grow stack-xs">
          <span class="tiny muted">${tp[cont.id].unitsDone ? 'המשך במסלול' : 'התחל מסלול'}: ${esc(cont.title_he)}</span>
          <span class="bold small">יחידה <bdi>${contNo}</bdi> - ${esc(contUnit.title_he)}</span>
          <span class="bar thin"><i style="--p:${Math.max(tp[cont.id].pct, 3)}%"></i></span>
        </span>
        <span class="chev-l">${icon('chevL')}</span>
      </button>` : ''}

      <div class="mini-grid">
        <a class="card mini goal-tile" href="#stats" aria-label="יעד יומי: ${todayMin} מתוך ${goal} דקות" data-testid="goal-ring">
          ${ringSvg(goalPct, { size: 44, stroke: 6, color: goalPct >= 100 ? 'var(--good)' : '', label: goalPct >= 100 ? `<span class="good-ink">${icon('check')}</span>` : `<b class="en-num ring-pct">${todayMin}</b>` })}
          <span class="stack-xs grow"><span class="bold small">יעד יומי</span><span class="tiny muted"><bdi>${todayMin}/${goal}</bdi> דק'</span></span>
        </a>
        <a class="card mini" href="#coach" data-testid="coach-tile">
          <span class="ico">${icon('sparkles')}</span>
          <span class="stack-xs grow"><span class="bold small">המאמן</span><span class="tiny muted">${talkIn !== null && talkIn >= 0 ? (talkIn === 0 ? 'ההרצאה היום!' : `עוד <bdi>${talkIn}</bdi> ימים להרצאה`) : 'הכנה להרצאה'}</span></span>
        </a>
      </div>

      <a class="card row-link" href="#path" data-topics data-testid="all-topics">
        <span class="ico">${icon('book')}</span>
        <span class="grow"><span class="bold small d-block">כל הנושאים</span><span class="tiny muted">תרגול חופשי לפי נושא</span></span>
        <span class="chev-l">${icon('chevL')}</span>
      </a>
    </div>
  </section>`;

  on(root, '[data-start]', 'click', () => {
    const t = ctx.nextTask();
    if (t) ctx.startTask(t);
  });
  on(root, '[data-cont]', 'click', (e, b) => {
    rememberTrack(b.dataset.cont);
    ctx.session.trackId = b.dataset.cont;
    ctx.go('track');
  });
  on(root, '[data-topics]', 'click', () => { ctx.session.pathTab = 'topics'; });
}
