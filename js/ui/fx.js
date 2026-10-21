// Feedback effects: toasts, modals, confetti, haptics, sounds.
import { esc, prefersReducedMotion } from './dom.js';
import { icon } from './icons.js';
import { artTrophy } from './art.js';

let settings = () => ({ haptics: true, sound: true });
export function bindSettings(fn) { settings = fn; }

export function haptic(pattern = 15) {
  try {
    if (!settings().haptics) return;
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch { /* ignore */ }
}

let actx = null;
export function sound(kind = 'good') {
  try {
    if (!settings().sound) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    actx = actx || new AC();
    if (actx.state === 'suspended') actx.resume();
    const notes = { good: [660, 880], bad: [300, 220], level: [523, 659, 784, 1046], tap: [520] }[kind] || [600];
    const t0 = actx.currentTime;
    notes.forEach((f, k) => {
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.type = kind === 'bad' ? 'triangle' : 'sine';
      o.frequency.value = f;
      const s = t0 + k * 0.09;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(0.12, s + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.22);
      o.connect(g).connect(actx.destination);
      o.start(s);
      o.stop(s + 0.25);
    });
  } catch { /* sound is optional */ }
}

const KIND_IC = { success: 'circleCheck', warn: 'info', error: 'circleAlert', badge: 'medal', info: 'sparkles' };

// toast(text, { kind:'success'|'warn'|'error'|'badge'|'info', title, iconName, ms })
export function toast(text, { kind = 'info', iconName = '', title = '', ms = 2600 } = {}) {
  const box = document.getElementById('toasts');
  if (!box) return;
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `<span class="ticon">${icon(iconName || KIND_IC[kind] || 'sparkles')}</span><div>${title ? `<div>${esc(title)}</div><div class="tsub">${esc(text)}</div>` : esc(text)}</div>`;
  box.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 320);
  }, ms);
}

// Generic modal. Returns { el, close }. Esc and scrim tap close it unless sticky.
// innerHtml is trusted HTML: callers must esc() every value that comes from state or content.
export function modal(innerHtml, { sheet = false, sticky = false, label = '', onClose } = {}) {
  const root = document.getElementById('overlay-root');
  const prev = document.activeElement;
  const scrim = document.createElement('div');
  scrim.className = `scrim${sheet ? ' sheet' : ''}`;
  scrim.innerHTML = `<div class="modal" role="dialog" aria-modal="true" ${label ? `aria-label="${esc(label)}"` : ''} tabindex="-1">${innerHtml}</div>`;
  root.appendChild(scrim);
  const box = scrim.firstElementChild;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    scrim.remove();
    try { prev && prev.focus && prev.focus(); } catch { /* ignore */ }
    onClose && onClose();
  };
  const onKey = (e) => {
    if (e.key === 'Escape' && !sticky) close();
    if (e.key === 'Tab') {
      const f = Array.from(box.querySelectorAll('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])')).filter((x) => !x.disabled);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
    }
  };
  document.addEventListener('keydown', onKey);
  scrim.addEventListener('click', (e) => { if (e.target === scrim && !sticky) close(); });
  setTimeout(() => (box.querySelector('[autofocus]') || box.querySelector('button') || box).focus(), 30);
  return { el: box, close };
}

// In-page confirm. Resolves true/false.
export function confirmBox({ title, text, ok = 'אישור', cancel = 'ביטול', danger = false }) {
  return new Promise((resolve) => {
    let val = false;
    const m = modal(`
      <div class="stack">
        <div class="ico" style="margin:0 auto;${danger ? 'background:var(--bad-50);color:var(--bad)' : ''}">${icon(danger ? 'trash' : 'sparkles')}</div>
        <h2 style="font-size:1.25rem">${esc(title)}</h2>
        <p class="muted">${esc(text)}</p>
        <div class="btn-row">
          <button class="btn line" data-a="no">${esc(cancel)}</button>
          <button class="btn ${danger ? 'danger' : ''}" data-a="yes">${esc(ok)}</button>
        </div>
      </div>`, { label: title, onClose: () => resolve(val) });
    m.el.querySelector('[data-a="no"]').focus();
    m.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]');
      if (!b) return;
      val = b.dataset.a === 'yes';
      m.close();
    });
  });
}

export function levelUpModal(lv, { xp = 0, badge = false } = {}) {
  sound('level');
  haptic([30, 60, 30]);
  return new Promise((resolve) => {
    const m = modal(`
      ${artStage(artTrophy(170))}
      <span class="lvl-pill">LEVEL ${lv.level}</span>
      <h2>עלית רמה!</h2>
      <p class="muted small">עכשיו אתה ${esc(lv.title_he || '')}. ההרצאה הבאה כבר פחות מפחידה.</p>
      <div class="rewards">
        ${xp ? `<span class="reward warn">${icon('starLine')} <bdi class="en-num">+${xp} XP</bdi></span>` : ''}
        ${badge ? `<span class="reward">${icon('sparkles')} תג חדש</span>` : ''}
      </div>
      <button class="btn block big" data-a="ok">מעולה, ממשיכים</button>`, { label: `עלית לרמה ${lv.level}`, onClose: resolve });
    m.el.querySelector('[data-a="ok"]').addEventListener('click', m.close);
    m.el.querySelector('[data-a="ok"]').focus();
  });
}

// Art stage for modals: warm glow, art, and still confetti bits.
export function artStage(art) {
  const bits = [
    ['8%', '12%', '#FFB020', -20], ['26%', '4%', '#E4DAFF', 30], ['84%', '10%', '#6C3BF5', 15], ['90%', '34%', '#FF7A1A', -30],
    ['14%', '62%', '#FF7A1A', 25], ['78%', '70%', '#22C55E', 0], ['20%', '30%', '#6C3BF5', 0], ['88%', '86%', '#FFB020', 40],
  ];
  return `<div class="art-stage" aria-hidden="true"><span class="glow"></span>${art}
    ${bits.map(([x, y, c, r], k) => `<i class="bit" style="left:${x};top:${y};background:${c};transform:rotate(${r}deg);animation-delay:${k * 60}ms"></i>`).join('')}
  </div>`;
}

// Canvas confetti. Respects reduced motion (static sparkle burst instead).
export function confetti({ count = 140, ms = 2600 } = {}) {
  if (prefersReducedMotion()) return;
  const c = document.createElement('canvas');
  c.className = 'confetti';
  c.setAttribute('aria-hidden', 'true');
  document.body.appendChild(c);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = window.innerWidth, H = window.innerHeight;
  c.width = W * dpr; c.height = H * dpr;
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  const colors = ['#6C3BF5', '#A47BFF', '#FFB020', '#FF7A1A', '#22C55E', '#FFD36E', '#F04438'];
  const parts = Array.from({ length: count }, () => ({
    x: W / 2 + (Math.random() - 0.5) * W * 0.4,
    y: H * 0.35,
    vx: (Math.random() - 0.5) * 9,
    vy: -Math.random() * 11 - 4,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    w: 6 + Math.random() * 6,
    h: 8 + Math.random() * 8,
    col: colors[(Math.random() * colors.length) | 0],
    round: Math.random() < 0.3,
  }));
  const t0 = performance.now();
  const frame = (t) => {
    const k = (t - t0) / ms;
    g.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.vy += 0.28; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      g.save();
      g.globalAlpha = Math.max(0, 1 - Math.max(0, k - 0.6) / 0.4);
      g.translate(p.x, p.y); g.rotate(p.r);
      g.fillStyle = p.col;
      if (p.round) { g.beginPath(); g.arc(0, 0, p.w / 2, 0, Math.PI * 2); g.fill(); }
      else g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)) + 2);
      g.restore();
    }
    if (k < 1) requestAnimationFrame(frame);
    else c.remove();
  };
  requestAnimationFrame(frame);
}
