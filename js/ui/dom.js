// Small DOM helpers shared by all screens.

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function on(root, sel, type, fn) {
  root.addEventListener(type, (e) => {
    const t = e.target.closest(sel);
    if (t && root.contains(t)) fn(e, t);
  });
}

export const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// SVG ring. pct 0..100. Returns html string.
// Numbers are coerced, cls/color/track are escaped. `label` is trusted HTML: build it
// from static markup and escaped or numeric values only.
export function ringSvg(pct, { size = 64, stroke = 7, cls = '', color = '', track = '', label = '' } = {}) {
  size = Number(size) || 64; stroke = Number(stroke) || 7;
  cls = esc(cls); color = esc(color); track = esc(track);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  const off = c * (1 - p / 100);
  return `<div class="ring ${cls}" style="width:${size}px;height:${size}px">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <circle class="track" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}" ${track ? `style="stroke:${track}"` : ''}/>
      <circle class="val" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}"
        stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}" data-c="${c.toFixed(2)}" ${color ? `style="stroke:${color}"` : ''}/>
    </svg>
    <div class="label">${label}</div>
  </div>`;
}

export function setRing(el, pct) {
  const v = el && el.querySelector('.val');
  if (!v) return;
  const c = Number(v.dataset.c);
  v.style.strokeDashoffset = String(c * (1 - Math.max(0, Math.min(100, pct)) / 100));
}

// Animate a number from 0 to `to` into el.textContent.
export function countUp(el, to, { ms = 1100, prefix = '', suffix = '' } = {}) {
  if (!el) return;
  const end = Math.round(Number(to) || 0);
  if (prefersReducedMotion() || end === 0) { el.textContent = prefix + end + suffix; return; }
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / ms);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = prefix + Math.round(end * e) + suffix;
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function fmtTime(sec) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Hebrew plural helper for simple counts.
export function heCount(n, one, many) { return n === 1 ? one : `${n} ${many}`; }
