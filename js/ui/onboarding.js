// Onboarding: 3 swipeable slides with the name, then 5 quick optional questions. First run only.
import { esc, on } from './dom.js';
import { icon } from './icons.js';
import { artSpeaker, artMap, artShield } from './art.js';
import { ROLES, GOALS, DAILY_MIN, profileOf } from './shell.js';

const SLIDES = [
  { art: () => artSpeaker(300), title: 'Speaker Trainer', en: true, text: 'רק 12 דקות ביום. מדברים אנגלית טכנית בביטחון, בלי מילות מילוי.',
    pills: `<span class="float-pill p1"><span class="gold-ic">${icon('starLine')}</span><bdi class="en-num">+20 XP</bdi></span><span class="float-pill p2"><bdi class="en-num">7</bdi><span class="flame-ic">${icon('flameLine')}</span></span>` },
  { art: () => artMap(220), title: 'משימה חדשה כל יום', text: '5 שלבים קצרים: חימום, תיקון, בחירה, דיבור ובוס. מה שקשה לך חוזר יותר.', pills: '' },
  { art: () => artShield(220), title: 'הקול שלך נשאר אצלך', text: 'האפליקציה לא שומרת ולא מעלה הקלטות. בלי מיקרופון? אפשר להקליד או לדרג את עצמך.', pills: '' },
];

// One meaning for "דלג" everywhere: skip the rest of the intro, keep what was filled, go home.
function skipAll(root, ctx, ans = null) {
  const v = (root.querySelector('#ob-name')?.value || '').trim().slice(0, 24);
  if (v) ctx.saveProfile({ name: v });
  if (ans) ctx.saveProfile({ role: ans.role || '', goals: ans.goals, nextTalkDate: ans.nextTalkDate || null, dailyGoalMin: ans.dailyGoalMin || 10, audiences: ans.audiences });
  ctx.set({ onboarded: true });
  ctx.haptic(20);
  ctx.go('home');
}

export function render(root, ctx) {
  // Back from home into an old intro entry: the intro is done, go home again.
  if (ctx.state.onboarded) { location.replace('#home'); return; }
  // System back steps back inside the questions (each question has its own history entry).
  let q = null;
  const onPop = (e) => {
    const st = e.state;
    if (st && typeof st.obq === 'number') { if (q) q.go(st.obq); else q = questions(root, ctx, st.obq); }
    else if (q) { q = null; slides(root, ctx, (qq) => { q = qq; }); }
  };
  window.addEventListener('popstate', onPop);
  ctx.onLeave(() => window.removeEventListener('popstate', onPop));
  slides(root, ctx, (qq) => { q = qq; });
}

function slides(root, ctx, setQ) {
  const name = ctx.state.name || '';
  root.innerHTML = `<section class="screen no-nav onboarding">
    <div class="ob-top"><button class="link-btn skip-btn" data-skip data-testid="onboarding-skip">דלג</button></div>
    <div class="ob-track" tabindex="0" aria-label="היכרות, 3 שקופיות" aria-roledescription="carousel">
      ${SLIDES.map((s, k) => `<article class="ob-slide" aria-roledescription="slide" aria-label="${k + 1} מתוך 3">
        <div class="ob-art"><div class="ob-circle"></div><div class="ob-shadow"></div>${s.art()}${s.pills}</div>
        <div class="ob-copy">
          <h1 class="${s.en ? 'en display' : ''}" ${s.en ? 'dir="ltr" lang="en"' : ''}>${esc(s.title)}</h1>
          <p>${esc(s.text)}</p>
        </div>
        ${k === 2 ? `<label class="field ob-name"><span class="lbl">איך לקרוא לך?</span><input class="input" id="ob-name" value="${esc(name)}" maxlength="24" autocomplete="given-name"></label>` : ''}
      </article>`).join('')}
    </div>
    <div class="ob-foot wrap">
      <div class="dots" aria-hidden="true">${SLIDES.map((_, k) => `<i class="${k === 0 ? 'on' : ''}"></i>`).join('')}</div>
      <button class="btn big" data-next>הבא ${icon('arrowL')}</button>
    </div>
  </section>`;

  const track = root.querySelector('.ob-track');
  const dots = root.querySelectorAll('.dots i');
  const nextBtn = root.querySelector('[data-next]');
  let cur = 0;

  const slideW = () => track.clientWidth;
  const idxNow = () => Math.round(Math.abs(track.scrollLeft) / Math.max(1, slideW()));
  const go = (k) => {
    const dir = getComputedStyle(track).direction === 'rtl' ? -1 : 1;
    track.scrollTo({ left: dir * k * slideW(), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    setCur(k);
  };
  function setCur(k) {
    cur = Math.max(0, Math.min(SLIDES.length - 1, k));
    dots.forEach((d, i) => d.classList.toggle('on', i === cur));
    nextBtn.innerHTML = cur === SLIDES.length - 1 ? `מתחילים ${icon('arrowL')}` : `הבא ${icon('arrowL')}`;
  }
  let t = null;
  track.addEventListener('scroll', () => { clearTimeout(t); t = setTimeout(() => setCur(idxNow()), 60); }, { passive: true });
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(cur + 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(cur - 1); }
  });

  const toQuestions = () => {
    const v = (root.querySelector('#ob-name')?.value || '').trim().slice(0, 24);
    if (v) ctx.saveProfile({ name: v });
    ctx.haptic(10);
    try { history.pushState({ obq: 0 }, ''); } catch { /* ignore */ }
    setQ(questions(root, ctx, 0));
  };
  nextBtn.addEventListener('click', () => (cur < SLIDES.length - 1 ? go(cur + 1) : toQuestions()));
  root.querySelector('[data-skip]').addEventListener('click', () => skipAll(root, ctx));
}

// ---------- quick questions (all optional) ----------

function questions(root, ctx, start = 0) {
  // Own host element: its delegated listeners die with it when the slides come back.
  const box = document.createElement('div');
  root.replaceChildren(box);
  const p = profileOf(ctx.state);
  const ans = { role: p.role, goals: [...p.goals], nextTalkDate: p.nextTalkDate, dailyGoalMin: p.dailyGoalMin, audiences: [...p.audiences] };
  const AUD = (ctx.C.AUDIENCES || []).map((a) => [a.id, a.name_he]);
  const today = ctx.E.todayStr();
  const STEPS = [
    { key: 'role', ic: 'user', q: 'מה התפקיד שלך?', hint: 'כדי לבחור דוגמאות שמתאימות לך.', kind: 'one', opts: ROLES },
    { key: 'goals', ic: 'target', q: 'בשביל מה אתה מתאמן?', hint: 'אפשר לבחור כמה.', kind: 'many', opts: GOALS },
    { key: 'nextTalkDate', ic: 'calendar', q: 'מתי ההרצאה הבאה שלך?', hint: 'נספור איתך אחורה.', kind: 'date' },
    { key: 'dailyGoalMin', ic: 'timer', q: 'כמה דקות ביום?', hint: 'יעד קטן שעומדים בו עדיף על יעד גדול.', kind: 'min' },
    { key: 'audiences', ic: 'users', q: 'מול מי אתה מדבר?', hint: 'אפשר לבחור כמה.', kind: 'many', opts: AUD },
  ].filter((x) => x.kind !== 'many' || x.opts.length);
  let k = Math.max(0, Math.min(STEPS.length - 1, start));

  const finish = () => {
    ctx.saveProfile({ role: ans.role || '', goals: ans.goals, nextTalkDate: ans.nextTalkDate || null, dailyGoalMin: ans.dailyGoalMin || 10, audiences: ans.audiences });
    ctx.set({ onboarded: true });
    ctx.haptic(20);
    ctx.go('home');
  };

  const draw = () => {
    const s = STEPS[k];
    const last = k === STEPS.length - 1;
    let body = '';
    if (s.kind === 'one' || s.kind === 'many') {
      const sel = s.kind === 'one' ? [ans[s.key]] : ans[s.key];
      body = `<div class="q-opts" role="group" aria-label="${esc(s.q)}">${s.opts.map(([id, he]) => `<button class="chip q-chip" data-opt="${esc(id)}" aria-pressed="${sel.includes(id)}">${sel.includes(id) ? icon('check') : ''}<bdi>${esc(he)}</bdi></button>`).join('')}</div>`;
    } else if (s.kind === 'date') {
      body = `<label class="field"><span class="lbl">תאריך</span><input class="input" type="date" id="q-date" min="${today}" value="${esc(ans.nextTalkDate || '')}"></label>
        <button class="chip q-chip" data-nodate aria-pressed="${!ans.nextTalkDate}">${!ans.nextTalkDate ? icon('check') : ''}אין לי הרצאה קרובה</button>`;
    } else {
      body = `<div class="seg q-seg" role="group" aria-label="דקות ביום">${DAILY_MIN.map((m) => `<button data-min="${m}" aria-pressed="${ans.dailyGoalMin === m}"><bdi class="en-num">${m}</bdi> דק'</button>`).join('')}</div>`;
    }
    box.innerHTML = `<section class="screen no-nav onboarding questions" data-testid="onboarding-questions">
      <div class="ob-top q-top">
        <span class="tiny muted">שאלה <bdi>${k + 1}</bdi> מתוך <bdi>${STEPS.length}</bdi></span>
        <button class="link-btn skip-btn" data-skip data-testid="onboarding-skip">דלג</button>
      </div>
      <div class="q-prog" aria-hidden="true">${STEPS.map((_, i) => `<i class="${i < k ? 'done' : i === k ? 'now' : ''}"></i>`).join('')}</div>
      <div class="q-body">
        <span class="ico q-ico">${icon(s.ic)}</span>
        <h1>${esc(s.q)}</h1>
        <p class="muted">${esc(s.hint)}</p>
        ${body}
      </div>
      <div class="ob-foot wrap">
        ${k > 0 ? `<button class="link-btn" data-back>${icon('arrowR')} חזרה</button>` : '<span></span>'}
        <button class="btn big" data-next>${last ? 'סיימתי' : 'הבא'} ${icon('arrowL')}</button>
      </div>
    </section>`;
    const h = box.querySelector('h1');
    h.setAttribute('tabindex', '-1');
    try { h.focus({ preventScroll: true }); } catch { /* ignore */ }
  };

  on(box, '[data-opt]', 'click', (e, b) => {
    const s = STEPS[k];
    const v = b.dataset.opt;
    if (s.kind === 'one') ans[s.key] = ans[s.key] === v ? '' : v;
    else ans[s.key] = ans[s.key].includes(v) ? ans[s.key].filter((x) => x !== v) : [...ans[s.key], v];
    ctx.haptic(8);
    draw();
  });
  on(box, '[data-min]', 'click', (e, b) => { ans.dailyGoalMin = Number(b.dataset.min); draw(); });
  on(box, '[data-nodate]', 'click', () => { ans.nextTalkDate = null; draw(); });
  box.addEventListener('change', (e) => {
    if (e.target.id === 'q-date') { ans.nextTalkDate = e.target.value || null; draw(); }
  });
  on(box, '[data-back]', 'click', () => { if (history.state && typeof history.state.obq === 'number' && history.state.obq > 0) history.back(); else { k = Math.max(0, k - 1); draw(); } });
  on(box, '[data-next]', 'click', () => {
    const d = box.querySelector('#q-date');
    if (d && d.value) ans.nextTalkDate = d.value;
    if (k < STEPS.length - 1) { k++; try { history.pushState({ obq: k }, ''); } catch { /* ignore */ } draw(); } else finish();
  });
  on(box, '[data-skip]', 'click', () => skipAll(root, ctx, ans));
  draw();
  return { go(n) { k = Math.max(0, Math.min(STEPS.length - 1, n)); draw(); } };
}
