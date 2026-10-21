// Home: greeting band with streak and level card, today's mission card, category chips, skills.
import { esc, ringSvg, on } from './dom.js';
import { icon } from './icons.js';
import { catMastery, greeting } from './shell.js';

let filter = 'all';

export function render(root, ctx) {
  const st = ctx.state;
  const lv = ctx.level();
  const d = st.daily;
  const total = d.tasks.length || 5;
  const done = d.done.length;
  const allDone = done >= total && total > 0;
  const next = ctx.nextTask();
  const minutes = d.tasks.reduce((a, t) => a + (t.minutes || 2), 0);
  const xpLeft = d.tasks.filter((t) => !d.done.includes(t.id)).reduce((a, t) => a + (t.xp || 0), 0) + (d.bonus ? 0 : 50);
  const name = (st.name || 'Daniel').trim() || 'Daniel';
  const streak = st.streak.count || 0;
  const streakAlive = st.streak.last === ctx.E.todayStr();
  const cats = ctx.C.CATEGORIES || [];
  const items = ctx.C.ITEMS || [];

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
      const col = c.color && c.color !== '#1B1530' && c.color !== '#8A84A3' ? c.color : '#6C3BF5';
      return `<button class="skill" data-cat="${esc(c.id)}" style="--c:${esc(col)}" aria-label="${esc(`תרגל ${c.label_he}. נשלט ${m.pct}%`)}">
        <span class="skill-top"><span class="skill-ico">${icon(c.icon || c.id)}</span><bdi class="skill-count en-num">${m.seen}/${m.count}</bdi></span>
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
  on(root, '[data-cat]', 'click', (e, b) => {
    const c = ctx.cat(b.dataset.cat);
    ctx.startPractice({ title_he: `תרגול: ${c ? c.label_he : ''}`, itemIds: ctx.pickForCat(b.dataset.cat, 4) });
  });
}
