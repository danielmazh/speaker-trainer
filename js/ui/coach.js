// Coach: audience picker in the band, icebreaker card, audience plan, tips accordion, practice links.
import { esc, on } from './dom.js';
import { icon } from './icons.js';
import { bindListen } from './tts.js';

let audId = null;
let iceIdx = -1;
const TIP_IC = ['slide', 'listChecks', 'pauseBars', 'message', 'users', 'target', 'mic', 'bulb'];

export function render(root, ctx) {
  const { AUDIENCES = [], ICEBREAKERS = [], COACH = [] } = ctx.C;
  if (!audId && AUDIENCES[0]) audId = AUDIENCES[0].id;
  if (iceIdx < 0 && ICEBREAKERS.length) iceIdx = Math.floor(Math.random() * ICEBREAKERS.length);

  root.innerHTML = `<section class="screen coach">
    <header class="band">
      <div><h1>המאמן</h1><p class="sub">הכנה מהירה לפני הרצאה</p></div>
      <div class="stack-xs">
        <span class="aud-label">מי בקהל?</span>
        <div class="seg on-band aud-seg" role="group" aria-label="בחר קהל">
          ${AUDIENCES.map((a) => `<button data-aud="${esc(a.id)}" aria-pressed="${a.id === audId}">${esc(a.name_he)}</button>`).join('')}
        </div>
      </div>
    </header>

    <div class="body">
      <div class="card ice-card-wrap">
        <div class="card-head">
          <span class="tag warn">${icon('smile')} פתיח</span>
          <div class="row nowrap">
            <button class="icon-btn light" data-say aria-label="הקשב בקול של הדפדפן">${icon('volume')}</button>
            <button class="icon-btn light" data-ice aria-label="עוד אחד">${icon('shuffle')}</button>
          </div>
        </div>
        <div data-iceout aria-live="polite"></div>
      </div>

      <div class="card stack-sm" data-audout></div>

      <div class="section-head"><h2>טיפים להצגה</h2></div>
      <div class="card acc-card">
        ${COACH.map((c, k) => `<details class="acc">
          <summary><span class="ico">${icon(TIP_IC[k % TIP_IC.length])}</span><span class="grow acc-title">${esc(c.title_he)}</span><span class="chev">${icon('chevDown')}</span></summary>
          <div class="acc-body">
            ${c.body_he ? `<p class="small">${esc(c.body_he)}</p>` : ''}
            ${(c.bullets_he || []).length ? `<ul class="dots-list">${c.bullets_he.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
            ${(c.examples_en || []).map((e) => `<button class="example en" dir="ltr" lang="en" data-say data-text="${esc(e)}" aria-label="${esc(`הקשב: ${e}`)}">"${esc(e)}"</button>`).join('')}
            <button class="btn ghost sm" data-practice="${esc(c.id)}">${icon('target')} תרגל את זה בקול</button>
          </div>
        </details>`).join('')}
      </div>
    </div>
  </section>`;

  const drawIce = () => {
    const i = ICEBREAKERS[iceIdx];
    const out = root.querySelector('[data-iceout]');
    if (!i) { out.innerHTML = '<p class="muted">אין כרגע שוברי קרח.</p>'; return; }
    out.innerHTML = `<div class="ice-in">
      <p class="en ice-line" dir="ltr" lang="en">"${esc(i.line_en)}"</p>
      <p class="small muted">מתי: ${esc(i.when_he)}</p>
    </div>`;
    root.querySelector('.ice-card-wrap [data-say]').dataset.text = i.line_en;
  };
  const drawAud = () => {
    const a = AUDIENCES.find((x) => x.id === audId);
    const out = root.querySelector('[data-audout]');
    if (!a) { out.hidden = true; return; }
    out.innerHTML = `<div class="card-head"><h2>מול ${esc(a.name_he)}</h2><span class="tag">${icon('users')} תוכנית</span></div>
      <ul class="checks">${(a.focus_he || []).map((f) => `<li>${icon('check')}<span>${esc(f)}</span></li>`).join('')}</ul>
      ${a.skip_he ? `<p class="small"><b>לדלג:</b> ${esc(a.skip_he)}</p>` : ''}
      ${a.open_en ? `<div class="tiny muted bold">פתיחה</div><button class="example en" dir="ltr" lang="en" data-say data-text="${esc(a.open_en)}">"${esc(a.open_en)}"</button>` : ''}
      ${a.joke_en ? `<div class="tiny muted bold">בדיחה קטנה</div><button class="example en" dir="ltr" lang="en" data-say data-text="${esc(a.joke_en)}">"${esc(a.joke_en)}"</button>` : ''}`;
    bindListen(out, '');
  };
  drawIce();
  drawAud();
  bindListen(root.querySelector('.ice-card-wrap'), '');
  bindListen(root.querySelector('.acc-card'), '');

  on(root, '[data-aud]', 'click', (e, b) => {
    audId = b.dataset.aud;
    root.querySelectorAll('[data-aud]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    ctx.haptic(8);
    drawAud();
  });
  on(root, '[data-ice]', 'click', () => {
    if (ICEBREAKERS.length > 1) {
      let k = iceIdx;
      while (k === iceIdx) k = Math.floor(Math.random() * ICEBREAKERS.length);
      iceIdx = k;
    }
    ctx.haptic(10);
    const box = root.querySelector('.ice-in');
    box?.classList.add('flip');
    setTimeout(drawIce, 160);
  });
  on(root, '[data-practice]', 'click', (e, b) => {
    const c = COACH.find((x) => x.id === b.dataset.practice);
    // Presenting tips map to scripts (openings, closings), tough Q&A, and free speaking.
    const qaLike = /q|question|answer|שאל/i.test(`${c?.id} ${c?.title_he}`);
    const ids = [
      ...ctx.pickForCat(qaLike ? 'qa' : 'scripts', 1),
      ...ctx.pickForCat('presenting', 2),
      ...ctx.pickForCat('speaking', 1, ['speak']),
    ];
    ctx.startPractice({ title_he: c ? c.title_he : 'תרגול הצגה', itemIds: [...new Set(ids)] });
  });
}
