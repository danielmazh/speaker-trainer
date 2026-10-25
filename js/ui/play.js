// Task runner: compact task band, plays every item of one task, feedback bottom sheet, then the result screen.
// Layout: band on top, the prompt in the middle, the mic (or answers) in a sticky dock at the bottom.
// Feedback is a fixed bottom sheet with its own scroll, so the prompt stays in view and "continue" is always visible.
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
// The task in progress survives a reload or a tab restore (sessionStorage, no audio, no answers).
const TASK_KEY = 'speakerTrainer.ui.task';
function saveTask(t) { try { sessionStorage.setItem(TASK_KEY, JSON.stringify(t)); } catch { /* private mode */ } }
function loadTask() { try { return JSON.parse(sessionStorage.getItem(TASK_KEY) || 'null'); } catch { return null; } }
export function clearSavedTask() { try { sessionStorage.removeItem(TASK_KEY); sessionStorage.removeItem(PROG_KEY); } catch { /* ignore */ } }
// Progress inside the task (item index and per-item scores and metrics, never transcripts or audio),
// so a reload or a killed tab resumes at the same item instead of item 1.
const PROG_KEY = 'speakerTrainer.ui.taskProgress';
function saveProgress(p) { try { sessionStorage.setItem(PROG_KEY, JSON.stringify(p)); } catch { /* private mode */ } }
function loadProgress(task) {
  try {
    const p = JSON.parse(sessionStorage.getItem(PROG_KEY) || 'null');
    if (!p || p.taskId !== task.id || !Array.isArray(p.results) || p.itemIds !== (task.itemIds || []).join(',')) return null;
    const results = p.results.filter((r) => r && typeof r.itemId === 'string' && Number.isFinite(Number(r.score)))
      .map((r) => ({ itemId: r.itemId, score: Math.max(0, Math.min(100, Math.round(Number(r.score)))), metrics: r.metrics && typeof r.metrics === 'object' ? r.metrics : { mode: 'tap', fromMic: false, words: 0, wpm: 0 } }));
    return results.length ? results : null;
  } catch { return null; }
}

// Restore only a plain task shape with string ids.
function validTask(t) {
  return t && typeof t === 'object' && typeof t.id === 'string' && Array.isArray(t.itemIds) && t.itemIds.every((x) => typeof x === 'string');
}

export function render(root, ctx) {
  let task = ctx.session.task;
  ctx.session.task = null;
  if (!task) {
    const saved = loadTask();
    if (validTask(saved)) task = saved;
  }
  // A daily task from yesterday (app left open over midnight): take today's next step instead.
  if (task && !task.practice && !(ctx.state.daily.tasks || []).some((t) => t.id === task.id)) {
    task = ctx.nextTask();
    if (task) ctx.toast('יום חדש, משימה חדשה.', { kind: 'info', iconName: 'calendar', ms: 2500 });
  }
  if (!task) task = ctx.nextTask();
  ctx.session.urls = [];
  // Privacy: recordings live only in memory and die when we leave this screen.
  ctx.onLeave(() => {
    for (const u of ctx.session.urls || []) { try { URL.revokeObjectURL(u); } catch { /* ignore */ } }
    ctx.session.urls = [];
    try { speechSynthesis.cancel(); } catch { /* ignore */ }
    document.body.classList.remove('fb-open');
  });

  if (!task) {
    clearSavedTask();
    root.innerHTML = `<section class="screen no-nav play" data-testid="play-empty">
      <header class="band compact"><div class="band-title"><a class="icon-btn" href="#home" aria-label="חזרה">${icon('arrowR')}</a><h1>אין שלבים פתוחים</h1></div></header>
      <div class="body"><div class="card stack center">
        <span class="ico" style="margin:0 auto">${icon('trophy')}</span>
        <p>סיימת את המשימה של היום. אפשר לתרגל נושא מהמסלול.</p>
      </div>
      <div class="action-bar"><a class="btn big block" href="#path">למסלול ${icon('arrowL')}</a></div></div></section>`;
    return;
  }
  saveTask(task);
  ctx.onLeave(clearSavedTask);

  const items = (task.itemIds || []).map((id) => ctx.item(id)).filter(Boolean);
  const kind = KIND[task.kind] || KIND.practice;
  const daily = ctx.state.daily.tasks;
  const stepNo = daily.findIndex((t) => t.id === task.id) + 1;
  const stepsMode = !task.practice && stepNo > 0 && daily.length > 1;
  // Where the close button leads: a track unit goes back to its track, free practice home, the mission to the map.
  const backTo = task.unit || task.back === 'track' ? 'track' : task.practice ? 'home' : 'mission';
  const unitTitle = task.title_he
    || ((ctx.track?.(task.trackId)?.units || []).find((u) => u.id === task.unitId) || {}).title_he || '';
  const results = [];
  let idx = 0;
  let busy = false;
  // Resume after a reload: same task, same items, the answers so far.
  const resumed = loadProgress(task);
  if (resumed && resumed.length < items.length && resumed.every((r, k) => items[k] && items[k].id === r.itemId)) {
    for (const r of resumed) results.push({ ...r, _take: null, _type: items[results.length].type, _choice: null });
    idx = results.length;
    ctx.toast('ממשיכים מאיפה שעצרת.', { kind: 'info', iconName: 'rotate', ms: 2200 });
  }
  const keepProgress = () => saveProgress({
    taskId: task.id, itemIds: (task.itemIds || []).join(','),
    results: results.map(({ itemId, score, metrics }) => ({ itemId, score, metrics })),
  });

  root.innerHTML = `<section class="screen no-nav play" data-testid="play">
    <header class="band task-band">
      <div class="task-bar">
        <button class="icon-btn" data-close data-testid="play-close" aria-label="יציאה מהשלב">${icon('x')}</button>
        <div class="segs${stepsMode ? ' steps' : ''}" role="progressbar" aria-valuemin="0" aria-valuemax="${items.length}" aria-valuenow="0" aria-label="התקדמות בשלב">
          ${(stepsMode ? daily : items).map(() => '<i></i>').join('')}
        </div>
        <span class="band-pill" data-pill></span>
      </div>
      <div class="task-head">
        <div class="kicker" data-kicker data-testid="play-kicker"></div>
        <h1 class="task-title" data-title></h1>
      </div>
      <div data-extra class="band-extra"></div>
    </header>
    <div class="body play-body">
      <div id="stage" class="stage" data-testid="stage"></div>
    </div>
    <div id="feedback" class="feedback" aria-live="polite" data-testid="feedback"></div>
  </section>`;

  const screen = root.querySelector('.play');
  const stage = root.querySelector('#stage');
  const fb = root.querySelector('#feedback');
  const segs = root.querySelectorAll('.segs i');
  const pill = root.querySelector('[data-pill]');

  // Leave guard: the router asks before it leaves #play (system back, nav). Nothing to lose: leave at once.
  const dirty = () => results.length > 0 || !!stage.querySelector('.mic[data-state="listening"], .mic[data-state="processing"]');
  const askLeave = () => (dirty()
    ? ctx.confirm({ title: task.unit ? 'לצאת מהיחידה?' : 'לצאת מהשלב?', text: 'מה שעשית בשלב הזה לא יישמר. ההקלטות נמחקות.', ok: 'לצאת', cancel: 'להישאר' })
    : Promise.resolve(true));
  ctx.setLeaveGuard?.(askLeave);
  ctx.onLeave(() => ctx.setLeaveGuard?.(null));

  // Band segments: in the daily mission one per step (done gold, current white with item progress),
  // in free practice one per item.
  function paintSegs(doneItems) {
    if (!stepsMode) {
      segs.forEach((s, k) => { s.className = k < doneItems ? 'done' : k === doneItems ? 'now' : ''; });
      return;
    }
    const doneIds = ctx.state.daily.done || [];
    segs.forEach((s, k) => {
      const t = daily[k];
      s.className = k === stepNo - 1 ? 'now' : doneIds.includes(t && t.id) ? 'done' : '';
    });
    const cur = segs[stepNo - 1];
    if (cur) cur.style.setProperty('--p', `${Math.max(15, Math.round((doneItems / items.length) * 100))}%`);
  }
  const xpPill = `<bdi>+${task.practice ? 5 : Math.max(0, Math.round(Number(task.xp) || 0))}</bdi><span class="gold-ic">${icon('starLine')}</span>`;

  const api = {
    ctx, finish,
    // `extra` is trusted markup only: callers build it with esc() for every content or state value.
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

  function closeSheet() {
    fb.innerHTML = '';
    screen.classList.remove('has-fb');
    document.body.classList.remove('fb-open');
    screen.style.removeProperty('--fb-h');
  }

  function show() {
    const it = items[idx];
    busy = false;
    closeSheet();
    // Badge toasts from the last result must not cover this task's header.
    document.querySelectorAll('#toasts .toast.badge').forEach((t) => t.remove());
    paintSegs(idx);
    root.querySelector('.segs').setAttribute('aria-valuenow', String(idx));
    const secs = it.type === 'speak' && Number(it.seconds) > 0 ? ` - ${Math.round(Number(it.seconds))} שניות` : '';
    const count = items.length > 1 ? ` - <bdi>${idx + 1}/${items.length}</bdi>` : '';
    // A track unit names the unit ("המילים של הסטטוס - 2/7"); the title may be English, so it is forced RTL.
    root.querySelector('[data-kicker]').innerHTML = task.unit
      ? `<bdi dir="rtl">${esc(unitTitle || 'יחידה')}</bdi>${secs}${count}`
      : `${esc(kind.he)}${secs} - ${task.practice ? 'תרגול' : `שלב ${stepNo} מתוך ${daily.length}`}${count}`;
    root.querySelector('[data-title]').textContent = TITLE[it.type] || task.title_he;
    root.querySelector('[data-extra]').innerHTML = '';
    pill.innerHTML = xpPill;
    stage.innerHTML = '';
    stage.classList.remove('in');
    void stage.offsetWidth;
    stage.classList.add('in');
    const P = PLAYERS[it.type];
    if (!P) { finish({ score: 0 }); return; }
    stage.dataset.item = it.id;
    stage.dataset.type = it.type;
    screen.dataset.type = it.type;
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
      metrics: take ? takeMetrics(take) : { mode: r.mode || 'tap', fromMic: false, words: 0, wpm: 0 },
      _take: take, _type: it.type,
      _choice: r.choice && typeof r.choice.picked === 'string' ? { picked: r.choice.picked, right: String(r.choice.right || '') } : null,
    });
    paintSegs(idx + 1);
    // A speak / Q&A countdown must not stay frozen in the band behind the feedback.
    pill.innerHTML = xpPill;
    const good = score >= 80, ok = score >= 50;
    if (!r.silent) { ctx.sound(good ? 'good' : ok ? 'tap' : 'bad'); ctx.haptic(good ? 20 : [30, 40, 30]); }
    const a = take && take.analysis;
    const tone = good ? 'good' : ok ? 'mid' : 'bad';
    const title = r.title || (good ? 'מצוין, כל הכבוד!' : ok ? 'כמעט. עוד קצת.' : 'לא נורא, ננסה שוב.');
    const tip = a && a.tips_he && a.tips_he[0];
    const last = idx === items.length - 1;
    const canRetry = !!take;
    const showDiff = a && a.diff && a.diff.length && ['fix', 'shadow', 'recall'].includes(it.type);
    const said = take && take.transcript && !showDiff
      ? `<p class="en said-text" dir="ltr" lang="en">${segHtml(ctx.A, take.transcript)}</p>` : '';
    const source = take ? (take.mode === 'typed' ? 'לפי מה שהקלדת' : take.selfScore != null ? 'לפי הדירוג שלך' : '') : '';
    // Long reveals (model answer, full text) sit behind a toggle so the sheet stays short.
    const reveal = r.revealHtml
      ? (r.revealLabel ? `<details class="fb-more" data-testid="fb-more"><summary>${icon('chevDown')} ${esc(r.revealLabel)}</summary>${r.revealHtml}</details>` : r.revealHtml)
      : '';

    fb.innerHTML = `<div class="fb-card ${tone}" role="region" aria-label="משוב">
      <div class="fb-scroll">
        <div class="fb-head">
          <span class="fb-ico">${icon(good ? 'check' : ok ? 'sparkles' : 'x')}</span>
          <div class="grow"><div class="fb-title">${esc(title)}</div>${source ? `<div class="tiny muted">${source}</div>` : ''}</div>
          <span class="tag ${good ? 'good' : ok ? 'warn' : 'bad'}">${icon(good ? 'check' : 'target')} <bdi>${score}%</bdi></span>
        </div>
        ${r.rule ? `<p class="en fb-rule" dir="ltr" lang="en">${esc(r.rule)}</p>` : ''}
        ${showDiff ? `<div class="tiny muted">מה אמרת מול המשפט</div>${diffHtml(result.displayDiff(a.diff), 36)}` : said ? `<div class="tiny muted">מה אמרת</div>${said}` : ''}
        ${a && a.beDrops && a.beDrops.length ? `<div class="small">תיקון: <span class="en fix-pair"><s>${esc(a.beDrops[0].text)}</s> ${icon('arrowR')} <b>${esc(a.beDrops[0].fix)}</b></span></div>` : ''}
        ${tip && !good ? `<p class="small fb-tip">${icon('bulb')} ${esc(tip)}</p>` : ''}
        ${reveal}
      </div>
      <div class="btn-row fb-foot">
        ${canRetry ? `<button class="btn line fixed" data-retry data-testid="retry">${icon('rotate')} נסה שוב</button>` : ''}
        <button class="btn big ${tone === 'good' ? 'good' : ''}" data-next data-testid="feedback-next">${last ? 'לתוצאות' : 'המשך'} ${icon('arrowL')}</button>
      </div>
    </div>`;
    screen.classList.add('has-fb');
    document.body.classList.add('fb-open');
    const nb = fb.querySelector('[data-next]');
    nb.addEventListener('click', next);
    fb.querySelector('[data-retry]')?.addEventListener('click', () => {
      results.pop();
      show();
    });
    r.afterFeedback && r.afterFeedback(fb);
    // Room under the content for the sheet, so the user can still scroll to anything it covers. No auto scroll.
    requestAnimationFrame(() => {
      const card = fb.querySelector('.fb-card');
      if (card) screen.style.setProperty('--fb-h', `${Math.round(card.getBoundingClientRect().height)}px`);
      nb.focus({ preventScroll: true });
    });
  }

  function next() {
    keepProgress();
    idx++;
    if (idx < items.length) { show(); return; }
    closeSheet();
    ctx.setLeaveGuard?.(null);
    clearSavedTask();
    const outcome = ctx.finishTask(task, results.map(({ itemId, score, metrics }) => ({ itemId, score, metrics })));
    result.render(root, ctx, { task, results, outcome, items });
  }

  on(root, '[data-close]', 'click', async () => {
    if (!(await askLeave())) return;
    ctx.setLeaveGuard?.(null);
    clearSavedTask();
    ctx.go(backTo);
  });

  show();
}
