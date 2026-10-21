// Task runner: task band, plays every item of one task, feedback sheet, then the result screen.
import { esc, on } from './dom.js';
import { icon } from './icons.js';
import { KIND } from './shell.js';
import { diffHtml, segHtml, takeMetrics } from './mic.js';
import * as shadow from './play-shadow.js';
import * as fix from './play-fix.js';
import * as choice from './play-choice.js';
import * as speak from './play-speak.js';
import * as recall from './play-recall.js';
import * as qa from './play-qa.js';
import * as result from './result.js';

const PLAYERS = { shadow, fix, choice, speak, recall, qa };
const TITLE = {
  shadow: 'חזור אחרי: אמור את המשפט בקול',
  fix: 'אמור את המשפט הנכון בקול',
  choice: 'איזה משפט נשמע טבעי?',
  speak: 'דבר בקול',
  recall: 'אמור את הטקסט בעל פה',
  qa: 'ענה על שאלה קשה',
};

export function render(root, ctx) {
  let task = ctx.session.task;
  ctx.session.task = null; // a reload or a new visit picks the next task again
  if (!task) task = ctx.nextTask();
  ctx.session.urls = [];
  // Privacy: recordings live only in memory and die when we leave this screen.
  ctx.onLeave(() => {
    for (const u of ctx.session.urls || []) { try { URL.revokeObjectURL(u); } catch { /* ignore */ } }
    ctx.session.urls = [];
    try { speechSynthesis.cancel(); } catch { /* ignore */ }
  });

  if (!task) {
    root.innerHTML = `<section class="screen no-nav play">
      <header class="band"><div class="band-title"><a class="icon-btn" href="#home" aria-label="חזרה">${icon('arrowR')}</a><h1>אין שלבים פתוחים</h1></div></header>
      <div class="body"><div class="card stack center">
        <span class="ico" style="margin:0 auto">${icon('trophy')}</span>
        <p>סיימת את המשימה של היום. אפשר לתרגל מיומנות מהמסך הראשי.</p>
        <a class="btn" href="#home">למסך הראשי</a>
      </div></div></section>`;
    return;
  }

  const items = (task.itemIds || []).map((id) => ctx.item(id)).filter(Boolean);
  const kind = KIND[task.kind] || KIND.practice;
  const daily = ctx.state.daily.tasks;
  const stepNo = daily.findIndex((t) => t.id === task.id) + 1;
  const results = [];
  let idx = 0;
  let busy = false;

  root.innerHTML = `<section class="screen no-nav play">
    <header class="band task-band">
      <div class="task-bar">
        <button class="icon-btn" data-close aria-label="יציאה מהשלב">${icon('x')}</button>
        <div class="segs" role="progressbar" aria-valuemin="0" aria-valuemax="${items.length}" aria-valuenow="0" aria-label="התקדמות בשלב">
          ${items.map(() => '<i></i>').join('')}
        </div>
        <span class="band-pill" data-pill></span>
      </div>
      <div>
        <div class="kicker" data-kicker></div>
        <h1 class="task-title" data-title></h1>
      </div>
      <div data-extra class="band-extra"></div>
    </header>
    <div class="body">
      <div id="stage" class="stage"></div>
      <div id="feedback" class="feedback" aria-live="polite"></div>
    </div>
  </section>`;

  const stage = root.querySelector('#stage');
  const fb = root.querySelector('#feedback');
  const segs = root.querySelectorAll('.segs i');
  const pill = root.querySelector('[data-pill]');
  const xpPill = `<bdi>+${task.practice ? 5 : task.xp || 0}</bdi><span class="gold-ic">${icon('starLine')}</span>`;

  const api = {
    ctx, finish,
    band({ title, extra = '' } = {}) {
      if (title) root.querySelector('[data-title]').textContent = title;
      root.querySelector('[data-extra]').innerHTML = extra;
      return root.querySelector('[data-extra]');
    },
    pill(html) { pill.innerHTML = html || xpPill; },
  };

  if (!items.length) {
    stage.innerHTML = `<div class="card empty">אין תרגילים בשלב הזה.</div>`;
    return;
  }

  function show() {
    const it = items[idx];
    busy = false;
    fb.innerHTML = '';
    segs.forEach((s, k) => { s.className = k < idx ? 'done' : k === idx ? 'now' : ''; });
    root.querySelector('.segs').setAttribute('aria-valuenow', String(idx));
    const where = task.practice ? 'תרגול' : `שלב ${stepNo} מתוך ${daily.length}`;
    root.querySelector('[data-kicker]').textContent = `${kind.he} - ${where}${items.length > 1 ? ` - ${idx + 1}/${items.length}` : ''}`;
    root.querySelector('[data-title]').textContent = TITLE[it.type] || task.title_he;
    root.querySelector('[data-extra]').innerHTML = '';
    pill.innerHTML = xpPill;
    stage.innerHTML = '';
    stage.classList.remove('in');
    void stage.offsetWidth;
    stage.classList.add('in');
    const P = PLAYERS[it.type];
    if (!P) { finish({ score: 0 }); return; }
    P.mount(stage, it, api);
    window.scrollTo({ top: 0 });
  }

  function finish(r) {
    if (busy) return;
    busy = true;
    const it = items[idx];
    const score = Math.max(0, Math.min(100, Math.round(Number(r.score) || 0)));
    const take = r.take || null;
    results.push({
      itemId: it.id, score,
      metrics: take ? takeMetrics(take) : { mode: r.mode || 'tap', fromMic: false },
      _take: take, _type: it.type,
    });
    segs[idx].className = 'done';
    const good = score >= 80, ok = score >= 50;
    if (!r.silent) { ctx.sound(good ? 'good' : ok ? 'tap' : 'bad'); ctx.haptic(good ? 20 : [30, 40, 30]); }
    const a = take && take.analysis;
    const tone = good ? 'good' : ok ? 'mid' : 'bad';
    const title = r.title || (good ? 'מצוין, כל הכבוד!' : ok ? 'כמעט. עוד קצת.' : 'לא נורא, ננסה שוב.');
    const tip = a && a.tips_he && a.tips_he[0];
    const last = idx === items.length - 1;
    const canRetry = !!take;
    const showDiff = a && a.diff && a.diff.length && ['fix', 'shadow', 'recall'].includes(it.type);
    const said = take && take.transcript && !showDiff && !['speak', 'qa'].includes(it.type)
      ? `<p class="en said-text">${segHtml(ctx.A, take.transcript)}</p>` : '';
    const source = take ? (take.mode === 'typed' ? 'לפי מה שהקלדת' : take.selfScore != null ? 'לפי הדירוג שלך' : '') : '';

    fb.innerHTML = `<div class="fb-card card ${tone}">
      <div class="fb-head">
        <span class="fb-ico">${icon(good ? 'check' : ok ? 'sparkles' : 'x')}</span>
        <div class="grow"><div class="fb-title">${esc(title)}</div>${source ? `<div class="tiny muted">${source}</div>` : ''}</div>
        <span class="tag ${good ? 'good' : ok ? 'warn' : 'bad'}">${icon(good ? 'check' : 'target')} <bdi>${score}%</bdi></span>
      </div>
      ${r.rule ? `<p class="en fb-rule">${esc(r.rule)}</p>` : ''}
      ${showDiff ? `<div class="tiny muted">מה שאמרת מול המשפט</div>${diffHtml(a.diff, 36)}` : said}
      ${a && a.beDrops && a.beDrops.length ? `<div class="small">תיקון: <span class="en fix-pair"><s>${esc(a.beDrops[0].text)}</s> ${icon('arrowR')} <b>${esc(a.beDrops[0].fix)}</b></span></div>` : ''}
      ${tip && !good ? `<p class="small fb-tip">${icon('bulb')} ${esc(tip)}</p>` : ''}
      ${r.revealHtml || ''}
      <div class="btn-row">
        ${canRetry ? `<button class="btn line fixed" data-retry>${icon('rotate')} שוב</button>` : ''}
        <button class="btn big ${tone === 'good' ? 'good' : tone === 'bad' && !canRetry ? 'bad' : ''}" data-next>${last ? 'לתוצאות' : 'המשך'} ${icon('arrowL')}</button>
      </div>
    </div>`;
    const nb = fb.querySelector('[data-next]');
    nb.addEventListener('click', next);
    fb.querySelector('[data-retry]')?.addEventListener('click', () => {
      results.pop();
      show();
    });
    r.afterFeedback && r.afterFeedback(fb);
    setTimeout(() => { fb.scrollIntoView({ behavior: 'smooth', block: 'end' }); nb.focus({ preventScroll: true }); }, 60);
  }

  function next() {
    idx++;
    if (idx < items.length) { show(); return; }
    const outcome = ctx.finishTask(task, results.map(({ itemId, score, metrics }) => ({ itemId, score, metrics })));
    result.render(root, ctx, { task, results, outcome, items });
  }

  on(root, '[data-close]', 'click', async () => {
    if (idx === 0 && !results.length) { ctx.go(task.practice ? 'home' : 'mission'); return; }
    const ok = await ctx.confirm({ title: 'לצאת מהשלב?', text: 'מה שעשית בשלב הזה לא יישמר. ההקלטות נמחקות.', ok: 'לצאת', cancel: 'להישאר' });
    if (ok) ctx.go(task.practice ? 'home' : 'mission');
  });

  show();
}
