// Shared screen pieces: header band, kind labels, mastery math.
import { esc } from './dom.js';
import { icon } from './icons.js';

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

export function band({ title, sub = '', back = '', right = '', extra = '' }) {
  return `<header class="band">
    <div class="band-title">
      ${back ? `<a class="icon-btn" href="${esc(back)}" aria-label="חזרה">${icon('arrowR')}</a>` : ''}
      <div class="grow"><h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>
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
