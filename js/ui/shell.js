// Shared screen pieces: header band, kind labels, mastery math.
import { esc } from './dom.js';
import { icon, hasIcon } from './icons.js';

export const KIND = {
  warmup: { he: 'חימום', ic: 'audioLines', color: '#22C55E' },
  fix: { he: 'תיקון', ic: 'wrench', color: '#6C3BF5' },
  choice: { he: 'בחירה', ic: 'listChecks', color: '#FF7A1A' },
  speak: { he: 'דיבור חופשי', ic: 'mic', color: '#F04438' },
  boss: { he: 'בוס', ic: 'crown', color: '#FFB020' },
  practice: { he: 'תרגול', ic: 'target', color: '#6C3BF5' },
};
export const KIND_SUB = {
  warmup: 'הגייה - חזור אחרי המילה',
  fix: 'אמור את המשפט הנכון',
  choice: 'בחר את הניסוח הטבעי',
  speak: 'דבר על נושא, בזמן',
  boss: 'שאלה קשה או טקסט בעל פה',
};
export const TYPE_HE = {
  shadow: 'חזור אחרי', fix: 'תקן בקול', choice: 'בחר', speak: 'דבר', recall: 'מהזיכרון', qa: 'שאלה קשה',
};

// title and sub are plain text (escaped here). right and extra are trusted static HTML.
export function band({ title, sub = '', back = '', right = '', extra = '' }) {
  return `<header class="band">
    <div class="band-title">
      ${back ? `<a class="icon-btn" href="${esc(back)}" aria-label="חזרה">${icon('arrowR')}</a>` : ''}
      <div class="grow"><h1>${esc(title)}</h1>${sub ? `<p class="sub">${esc(sub)}</p>` : ''}</div>
      ${right}
    </div>
    ${extra}
  </header>`;
}

// 0..1 mastery for one item state.
export function itemMastery(s) {
  if (!s) return 0;
  if (Number(s.interval) >= 21) return 1;
  return Math.min(1, (Number(s.reps) || 0) / 4 + (Number(s.interval) || 0) / 42);
}

export function catMastery(state, items, catId) {
  const list = items.filter((it) => it.cat === catId);
  if (!list.length) return { pct: 0, count: 0, seen: 0 };
  let sum = 0, seen = 0;
  for (const it of list) {
    const s = state.items[it.id];
    if (s) seen++;
    sum += itemMastery(s);
  }
  return { pct: Math.round((sum / list.length) * 100), count: list.length, seen };
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 5) return 'עדיין ער? אימון קצר וישנים';
  if (h < 12) return 'בוקר טוב. מוכן לאימון של היום?';
  if (h < 18) return 'מוכן לאימון של היום?';
  return 'ערב טוב. מוכן לאימון של היום?';
}

// ---------- phase 3 shared bits ----------

KIND.unit = { he: 'יחידה', ic: 'map', color: '#6C3BF5' };

// Profile answer options (ids are stored, Hebrew is shown).
export const ROLES = [
  ['dev', 'מפתח/ת'], ['lead', 'ראש צוות'], ['manager', 'מנהל/ת'], ['product', 'מוצר'], ['ops', 'DevOps / SRE'], ['other', 'אחר'],
];
export const GOALS = [
  ['talk', 'הרצאה או כנס'], ['meetings', 'פגישות בעבודה'], ['status', 'עדכוני סטטוס'], ['customers', 'שיחות עם לקוחות'], ['interview', 'ראיון עבודה'], ['confidence', 'ביטחון כללי'],
];
export const DAILY_MIN = [5, 10, 15, 20];

// Category color, readable on light and dark surfaces.
export function catColor(c) {
  const col = c && c.color;
  return col && !['#1B1530', '#8A84A3'].includes(String(col).toUpperCase()) ? col : '#6C3BF5';
}

// Extra icons for the new skills and tracks (icons.js has no paths for them).
const EXTRA = {
  status: '<path d="M4 20V10M10 20V4M16 20v-7"/><path d="m14 8 3-3 3 3"/>',
  incident: '<path d="M12 3 2.5 20h19z"/><path d="M12 10v4M12 17h.01"/>',
  systems: '<rect x="3" y="3" width="7" height="6" rx="1.5"/><rect x="14" y="3" width="7" height="6" rx="1.5"/><rect x="8.5" y="15" width="7" height="6" rx="1.5"/><path d="M6.5 9v3h11V9M12 12v3"/>',
  meetings: '<circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M2.5 19a5.5 5.5 0 0 1 11 0M10.5 19a5.5 5.5 0 0 1 11 0"/>',
  numbers: '<path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16"/>',
  vocab: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M9 7h7M9 11h5"/>',
  stress: '<path d="M3 18c3 0 3-6 6-6s3 6 6 6 3-12 6-12"/><circle cx="18" cy="6" r="1.5" fill="currentColor"/>',
  interview: '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  smalltalk: '<path d="M14 9a2 2 0 0 1-2 2H6l-3 3V4a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2z"/><path d="M18 9h1a2 2 0 0 1 2 2v10l-3-3h-6a2 2 0 0 1-2-2v-1"/>',
  path: '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h8.5a3.5 3.5 0 0 0 0-7h-9a3.5 3.5 0 0 1 0-7H16"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  upload: '<path d="M12 21V9M7 14l5-5 5 5M4 3h16"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2.5"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  rocket: '<path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2"/><path d="M9 15 6 12c1-4 4.5-8.5 12-9 0 7.5-5 11-9 12z"/><circle cx="14.5" cy="9.5" r="1.5"/>',
  alert: '<path d="M12 3 2.5 20h19z"/><path d="M12 10v4M12 17h.01"/>',
  network: '<rect x="3" y="3" width="7" height="6" rx="1.5"/><rect x="14" y="3" width="7" height="6" rx="1.5"/><rect x="8.5" y="15" width="7" height="6" rx="1.5"/><path d="M6.5 9v3h11V9M12 12v3"/>',
  hash: '<path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  coffee: '<path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 2v3M12 2v3"/>',
};
const EXTRA_ALIAS = {
  'alert-triangle': 'alert', 'triangle-alert': 'alert', siren: 'incident', activity: 'status', 'bar-chart': 'status', 'trending-up': 'status',
  'git-branch': 'systems', server: 'systems', boxes: 'systems', blocks: 'systems', layers: 'systems', workflow: 'systems',
  'users-round': 'meetings', handshake: 'meetings', calculator: 'numbers', percent: 'numbers', binary: 'numbers',
  'book-open': 'vocab', languages: 'vocab', 'audio-waveform': 'stress', music: 'stress', 'user-check': 'interview',
  'message-circle': 'smalltalk', 'messages-square': 'smalltalk', route: 'path', milestone: 'path', map: 'path',
};

// Icon by name, with the extra set first. `fallback` is tried next (usually a category id).
export function ic(name, fallback = '', cls = '') {
  for (const n of [name, EXTRA_ALIAS[name], fallback, EXTRA_ALIAS[fallback]]) {
    if (n && EXTRA[n]) return `<svg class="${esc(cls)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${EXTRA[n]}</svg>`;
  }
  if (name && hasIcon(name)) return icon(name, cls);
  if (fallback && hasIcon(fallback)) return icon(fallback, cls);
  return icon(name || fallback, cls);
}

// Remembered track for the #track screen (bare hash only, so the id lives here).
const TRACK_KEY = 'speakerTrainer.ui.track';
export function rememberTrack(id) { try { localStorage.setItem(TRACK_KEY, id); } catch { /* private mode */ } }
export function rememberedTrack() { try { return localStorage.getItem(TRACK_KEY) || ''; } catch { return ''; } }

export function profileOf(st) {
  const p = (st && st.profile) || {};
  return {
    name: p.name || st.name || '',
    role: p.role || '',
    goals: Array.isArray(p.goals) ? p.goals : [],
    focusTracks: Array.isArray(p.focusTracks) ? p.focusTracks : [],
    dailyGoalMin: Number(p.dailyGoalMin) > 0 ? Number(p.dailyGoalMin) : 10,
    nextTalkDate: p.nextTalkDate || null,
    audiences: Array.isArray(p.audiences) ? p.audiences : [],
  };
}

export function daysUntil(dateStr, today) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const a = new Date(`${today}T12:00:00`), b = new Date(`${dateStr}T12:00:00`);
  return Math.round((b - a) / 86400000);
}

// ---------- bottom nav (2026-10-25: labels under icons, clear active state, 44px+ targets) ----------

// Tab routes. `play` is the raised center button (starts the next step of today's mission).
export const NAV_TABS = [
  { r: 'home', label: 'בית', ic: 'home' },
  { r: 'path', label: 'מסלול', ic: 'map' },
  { r: 'play', label: 'אימון', ic: 'play', center: true },
  { r: 'stats', label: 'נתונים', ic: 'chart' },
  { r: 'profile', label: 'פרופיל', ic: 'user' },
];

// Which tab is lit for a route (detail screens light their parent tab).
export function navActive(route) {
  if (route === 'mission') return 'home';
  if (route === 'coach' || route === 'track') return 'path';
  return route;
}

export function navHtml() {
  return NAV_TABS.map((n) => n.center
    ? `<span class="slot-center"><a href="#play" class="center" data-r="play" aria-label="${esc(n.label)}: המשימה של היום" title="המשימה של היום"><span class="pulse" aria-hidden="true"></span><span class="core">${icon(n.ic)}</span></a><span class="nav-lbl center-lbl" aria-hidden="true">${esc(n.label)}</span></span>`
    : `<a href="#${n.r}" data-r="${n.r}" class="tab">${icon(n.ic)}<span class="nav-lbl">${esc(n.label)}</span></a>`).join('');
}

// Nav label styles. Kept here until css/components.css takes them over (it is owned by
// another contributor). Inline <style> is allowed by the CSP (style-src 'unsafe-inline').
export const NAV_CSS = `
.nav a.tab { width: auto; min-width: 56px; min-height: 52px; height: auto; border-radius: 18px; padding: 4px 6px 3px; gap: 1px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.nav a.tab svg { width: 22px; height: 22px; }
.nav .nav-lbl { font-size: 11px; line-height: 1.1; font-weight: 600; letter-spacing: 0; white-space: nowrap; }
.nav a.tab[aria-current="page"] { color: #fff; background: rgba(255,255,255,.18); }
.nav a.tab[aria-current="page"] .nav-lbl { font-weight: 800; }
.nav a.tab[aria-current="page"]::after { display: none; }
.nav .slot-center { position: relative; display: flex; align-items: flex-end; justify-content: center; }
.nav .center-lbl { position: absolute; bottom: -2px; inset-inline: 0; text-align: center; color: #fff; }
`;
