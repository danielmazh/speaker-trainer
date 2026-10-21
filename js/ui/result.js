// Result per task: band with animated score ring, XP count-up and streak; filler bars, diffs,
// tips, in-memory recording playback with a privacy line; retry or continue.
import { esc, ringSvg, setRing, countUp, fmtTime, prefersReducedMotion } from './dom.js';
import { icon } from './icons.js';
import { artTrophy } from './art.js';
import { artStage } from './fx.js';
import { diffHtml, segHtml } from './mic.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// Stored state is untrusted: numbers from it are coerced before they reach innerHTML.
const int = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0);

function headline(avg) {
  if (avg >= 90) return ['וואו, כמו על במה!', 'ככה נשמע דובר בטוח.'];
  if (avg >= 75) return ['כל הכבוד!', 'עוד צעד לבמה.'];
  if (avg >= 50) return ['בדרך הנכונה', 'עוד סיבוב אחד וזה יושב.'];
  return ['כל ניסיון מחזק', 'ננסה שוב, לאט יותר.'];
}

// Stable pseudo waveform per recording (decorative).
function waveBars(seed, n = 27) {
  let h = seed * 9301 + 49297;
  return Array.from({ length: n }, () => { h = (h * 9301 + 49297) % 233280; return 8 + Math.round((h / 233280) * 22); });
}

export function render(root, ctx, { task, results, outcome, items }) {
  const avg = results.length ? Math.round(results.reduce((a, r) => a + r.score, 0) / results.length) : 0;
  const [title, sub] = headline(avg);
  const st = ctx.state;
  const isUnit = !!(task.unit || task.back === 'track');
  const next = task.practice || isUnit ? null : ctx.nextTask();

  // Fillers across all spoken takes.
  const fill = {};
  let words = 0, secs = 0;
  for (const r of results) {
    const a = r._take && r._take.analysis;
    if (!a || r._take.mode !== 'speech') continue;
    for (const [k, v] of Object.entries(a.fillers || {})) fill[k] = (fill[k] || 0) + v;
    words += a.words; secs += Number(r._take.durationSec) || 0;
  }
  const fillRows = Object.entries(fill).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const fillMax = Math.max(1, ...fillRows.map((x) => x[1]));
  const fillTotal = fillRows.reduce((a, x) => a + x[1], 0);
  const fpm = secs > 0 ? Math.round((fillTotal / (secs / 60)) * 10) / 10 : 0;
  const spokeAtAll = results.some((r) => r._take && r._take.mode === 'speech' && r._take.analysis && r._take.analysis.words);

  const tips = [];
  for (const r of results) for (const t of (r._take && r._take.analysis && r._take.analysis.tips_he) || []) if (!tips.includes(t)) tips.push(t);

  const diffs = results.map((r, k) => ({ r, it: items[k] })).filter(({ r }) => {
    const a = r._take && r._take.analysis;
    return a && a.diff && a.diff.length && ['fix', 'shadow', 'recall'].includes(r._type);
  });
  const recs = results.map((r, k) => ({ r, k })).filter(({ r }) => r._take && r._take.audioUrl);

  root.innerHTML = `<section class="screen no-nav result" data-testid="result">
    <header class="band result-band">
      <div class="result-row">
        <div class="result-text">
          <h1>${esc(title)}</h1>
          <p class="sub">${esc(sub)}</p>
          <div class="row">
            <span class="band-pill"><bdi>+<span data-xp data-testid="xp-gained">0</span> XP</bdi><span class="gold-ic">${icon('starLine')}</span></span>
            <span class="band-pill ${outcome.streakUp ? 'pop' : ''}"><bdi>${int(st.streak && st.streak.count)}</bdi><span class="flame-ic">${icon('flameLine')}</span></span>
          </div>
        </div>
        ${ringSvg(0, { size: 124, stroke: 20, cls: 'on-band score-ring', label: `<div><b class="score-n en-num" data-testid="score">0</b><div class="of" dir="ltr">/100</div></div>` })}
      </div>
    </header>

    <div class="body">
      ${outcome.unitDone || outcome.bossPassed ? `<div class="card mission-done" data-testid="unit-done"><span class="md-art">${artTrophy(64)}</span><div class="grow"><div class="bold">${outcome.unitDone ? 'יחידה הושלמה!' : 'ניצחת את הבוס!'}</div><div class="small muted">${outcome.unitDone ? 'היחידה הבאה במסלול נפתחה.' : 'עוד קצת תרגול, והיחידה מאחוריך.'}</div></div></div>` : ''}
      ${outcome.missionDone ? `<div class="card mission-done" data-testid="mission-done"><span class="md-art">${artTrophy(64)}</span><div class="grow"><div class="bold">המשימה היומית הושלמה!</div><div class="small muted">5 מתוך 5, כולל בונוס של 50 XP.</div></div></div>` : ''}

      ${spokeAtAll ? `<div class="card stack-sm">
        <div class="card-head"><h2>מילות מילוי</h2><bdi class="en-num bold ${fpm >= 1 ? 'bad-text' : 'good-ink'}">${fpm} / min</bdi></div>
        ${fillRows.length ? `<ul class="fill-rows" dir="ltr" data-testid="filler-rows">${fillRows.map(([w, n]) => `<li><span class="en fw">${esc(w)}</span><span class="bar"><i style="--p:${Math.round((n / fillMax) * 100)}%;background:${n >= 2 ? 'var(--bad)' : 'var(--warn)'}"></i></span><span class="fx en-num">x${n}</span></li>`).join('')}</ul>`
          : `<p class="small good-ink">${icon('check')} אפס מילות מילוי. ככה בדיוק!</p>`}
      </div>` : ''}

      ${diffs.length ? `<div class="card stack-sm">
        <h2 class="card-title">המשפט המתוקן</h2>
        ${diffs.map(({ r }) => diffHtml(displayDiff(r._take.analysis.diff), 36).replace(/<div class="diff-key[\s\S]*?<\/div>/, '')).join('<hr class="soft">')}
        <div class="diff-key tiny"><span class="d-ok">נאמר</span><span class="d-miss">חסר</span><span class="d-extra">נוסף</span></div>
      </div>` : ''}

      ${!diffs.length && results.some((r) => r._take && r._take.transcript) ? `<div class="card stack-sm">
        <h2 class="card-title">מה שאמרת</h2>
        ${results.filter((r) => r._take && r._take.transcript).map((r) => `<p class="en said-text" dir="ltr">${segHtml(ctx.A, r._take.transcript)}</p>`).join('')}
      </div>` : ''}

      ${tips.length ? `<div class="card stack-sm">
        <h2 class="card-title">${icon('bulb')} טיפים</h2>
        <ul class="tips">${tips.slice(0, 3).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      </div>` : ''}

      ${recs.length ? `<div class="card stack-sm">
        ${recs.map(({ r, k }) => `<div class="player" data-k="${k}">
          <button class="play-btn" data-testid="playback" data-audio="${k}" aria-label="השמע את ההקלטה">${icon('play')}</button>
          <div class="pl-text"><div class="bold small">השמע את ההקלטה${recs.length > 1 ? ` ${recs.indexOf(recs.find((x) => x.k === k)) + 1}` : ''}</div><bdi class="tiny muted en-num">${fmtTime(r._take.durationSec || 0)}</bdi></div>
          <div class="pl-wave" aria-hidden="true">${waveBars(k + 3).map((hh) => `<i style="height:${hh}px"></i>`).join('')}</div>
        </div>`).join('')}
        <p class="privacy-line">${icon('lock2')} ההקלטה נשמרת רק בזיכרון ונמחקת כשיוצאים מהמסך.</p>
      </div>` : `<p class="privacy-line">${icon('lock2')} האפליקציה לא שומרת ולא מעלה הקלטות.</p>`}

      <div class="btn-row">
        <button class="btn line fixed" data-again data-testid="again">${icon('rotate')} שוב</button>
        ${isUnit ? `<a class="btn big" href="#track" data-testid="result-track">חזרה למסלול ${icon('arrowL')}</a>`
          : next ? `<button class="btn big" data-next data-testid="result-next">המשך לשלב הבא ${icon('arrowL')}</button>`
          : `<a class="btn big" href="#home" data-testid="result-home">הביתה ${icon('arrowL')}</a>`}
      </div>
    </div>
  </section>`;
  window.scrollTo(0, 0);

  const ring = root.querySelector('.score-ring');
  const reduce = prefersReducedMotion();
  requestAnimationFrame(() => setTimeout(() => setRing(ring, avg), reduce ? 0 : 80));
  countUp(root.querySelector('.score-n'), avg, { ms: 900 });
  setTimeout(() => countUp(root.querySelector('[data-xp]'), outcome.xpGained, { ms: 800 }), reduce ? 0 : 400);

  // Playback from in-memory blob URLs only. The play screen revokes them on leave.
  let audio = null, playing = null, raf = 0;
  const stopAll = () => {
    if (audio) audio.pause();
    cancelAnimationFrame(raf);
    if (playing) { playing.innerHTML = icon('play'); playing.closest('.player').style.setProperty('--prog', '0'); }
    playing = null;
  };
  root.querySelectorAll('[data-audio]').forEach((b) => {
    b.addEventListener('click', () => {
      if (playing === b) { stopAll(); return; }
      stopAll();
      const url = results[Number(b.dataset.audio)]._take.audioUrl;
      audio = new Audio(url);
      audio.onended = stopAll;
      audio.play().catch(stopAll);
      playing = b;
      b.innerHTML = icon('pause');
      const pl = b.closest('.player');
      const bars = Array.from(pl.querySelectorAll('.pl-wave i'));
      const step = () => {
        if (!audio || playing !== b) return;
        const d = audio.duration && Number.isFinite(audio.duration) ? audio.duration : (results[Number(b.dataset.audio)]._take.durationSec || 1);
        const p = Math.min(1, audio.currentTime / d);
        bars.forEach((x, i) => x.classList.toggle('played', i / bars.length <= p));
        raf = requestAnimationFrame(step);
      };
      step();
    });
  });
  ctx.onLeave(stopAll);

  root.querySelector('[data-next]')?.addEventListener('click', () => { const t = ctx.nextTask(); if (t) ctx.startTask(t); });
  root.querySelector('[data-again]').addEventListener('click', () => {
    ctx.startTask({ ...task, id: task.id });
  });

  // Celebrations in order: mission complete, level up, badges.
  (async () => {
    await wait(reduce ? 200 : 1200);
    if (outcome.missionDone) {
      ctx.confetti({ count: 160 });
      ctx.haptic([30, 50, 30, 50, 60]);
      await missionModal(ctx);
    }
    if (outcome.levelUp) {
      ctx.confetti({ count: 90 });
      await ctx.levelUpModal(outcome.levelUp, { xp: outcome.xpGained, badge: outcome.newBadges.length > 0 });
    }
    if (outcome.newBadges.length) ctx.announceBadges(outcome.newBadges);
  })();
}

function missionModal(ctx) {
  const st = ctx.state;
  const lv = ctx.level();
  return new Promise((resolve) => {
    ctx.sound('level');
    const m = ctx.modal(`
      ${artStage(artTrophy(170))}
      <span class="lvl-pill">5 / 5</span>
      <h2>המשימה הושלמה!</h2>
      <p class="muted small">עוד יום של אנגלית בקול. ככה בונים ביטחון לבמה.</p>
      <div class="rewards">
        <span class="reward warn">${icon('flameLine')} <bdi>${int(st.streak && st.streak.count)}</bdi> ימים ברצף</span>
        <span class="reward">${icon('starLine')} רמה <bdi>${int(lv.level)}</bdi></span>
      </div>
      <button class="btn block big" data-ok>מעולה, ממשיכים</button>`, { label: 'המשימה הושלמה', onClose: resolve });
    m.el.querySelector('[data-ok]').addEventListener('click', m.close);
    m.el.querySelector('[data-ok]').focus();
  });
}

// Show the original words (casing and punctuation) when analyze.js gave them in `orig`.
// A continuation piece of an expanded word ("gonna" -> going to) has orig '': hide it
// when it has the same status as the piece before, else show its normalized word.
// Older saved takes have no `orig`, so they fall back to the normalized `w`.
export function displayDiff(diff) {
  const out = [];
  let prev = null;
  for (const d of diff || []) {
    if (typeof d.orig !== 'string') out.push(d);
    else if (d.orig) out.push({ ...d, w: d.orig });
    else if (!prev || prev.status !== d.status) out.push(d);
    prev = d;
  }
  return out;
}
