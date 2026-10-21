// Profile: name, look, feedback, privacy and mic settings, reset.
import { esc, on } from './dom.js';
import { icon } from './icons.js';
import { band } from './shell.js';

const OD_HE = { yes: 'מוכן במכשיר', no: 'לא זמין במכשיר', unknown: 'לא ידוע' };

export function render(root, ctx) {
  const st = ctx.state;
  const set = st.settings;
  const sup = ctx.S.support();

  root.innerHTML = `<section class="screen profile">
    ${band({ title: 'פרופיל והגדרות', sub: 'הכול נשמר רק בדפדפן הזה.', back: '#home' })}
    <div class="body">
      <div class="card stack-sm">
        <label class="field"><span class="lbl">השם שלך</span>
          <div class="row" style="flex-wrap:nowrap">
            <input class="input" id="pf-name" value="${esc(st.name || '')}" maxlength="24" autocomplete="given-name">
            <button class="btn sm" data-savename>שמור</button>
          </div>
        </label>
      </div>

      <div class="card stack-sm">
        <h2>${icon('sun', 'h-ic')} מראה ותחושה</h2>
        <div class="lbl small">ערכת צבעים</div>
        <div class="seg" role="group" aria-label="ערכת צבעים">
          ${[['system', 'אוטומטי'], ['light', 'בהיר'], ['dark', 'כהה']].map(([v, l]) => `<button data-theme="${v}" aria-pressed="${set.theme === v}">${l}</button>`).join('')}
        </div>
        <div class="switch-row"><span>רטט בתשובות</span><button class="switch" role="switch" aria-checked="${!!set.haptics}" data-toggle="haptics" aria-label="רטט בתשובות"></button></div>
        <div class="switch-row"><span>צלילים</span><button class="switch" role="switch" aria-checked="${!!set.sound}" data-toggle="sound" aria-label="צלילים"></button></div>
      </div>

      <div class="card stack-sm">
        <h2>${icon('shield', 'h-ic')} פרטיות ומיקרופון</h2>
        <div class="note">${icon('shield')}<span>האפליקציה <b>אף פעם</b> לא שומרת ולא מעלה את הקול שלך. ההקלטה נמצאת רק בזיכרון של הדף, ונמחקת כשאתה עוזב את המסך.</span></div>
        <p class="small">המרת דיבור לטקסט נעשית על ידי הדפדפן. במצב <b>על המכשיר</b> הכול קורה בטלפון. בלי מצב הזה, שירות הדיבור של הדפדפן (ב-Chrome זה Google) מקבל את הקול כדי להפוך אותו לטקסט. זה השירות של הדפדפן, לא שלנו.</p>
        <div class="status-grid small">
          <span>זיהוי דיבור</span><b class="${sup.recognition ? 'ok' : 'no'}">${sup.recognition ? 'נתמך' : 'לא נתמך'}</b>
          <span>על המכשיר</span><b data-od class="${sup.onDevice === 'yes' ? 'ok' : sup.onDevice === 'no' ? 'no' : ''}">${OD_HE[sup.onDevice]}</b>
          <span>הקלטה</span><b class="${sup.recorder ? 'ok' : 'no'}">${sup.recorder ? 'נתמכת' : 'לא נתמכת'}</b>
          <span>חיבור מאובטח</span><b class="${sup.secure ? 'ok' : 'no'}">${sup.secure ? 'כן' : 'לא (המיקרופון צריך https)'}</b>
        </div>
        <div class="lbl small">זיהוי על המכשיר</div>
        <div class="seg" role="group" aria-label="זיהוי על המכשיר">
          ${[['auto', 'אוטומטי'], ['on', 'רק במכשיר'], ['off', 'שירות הדפדפן']].map(([v, l]) => `<button data-od-set="${v}" aria-pressed="${set.onDevice === v}">${l}</button>`).join('')}
        </div>
        <p class="tiny muted" data-od-help></p>
        <button class="btn ghost sm" data-install hidden>${icon('sparkles')} הורד מודל דיבור למכשיר</button>
      </div>

      <div class="card stack-sm">
        <h2>${icon('trash', 'h-ic')} איפוס</h2>
        <p class="small muted">מוחק נקודות, רצף, תגים והיסטוריה. אי אפשר לבטל.</p>
        <button class="btn line" data-reset style="color:var(--bad);border-color:var(--bad-50)">${icon('trash')} אפס את ההתקדמות</button>
      </div>

      <p class="tiny muted center">Speaker Trainer · בלי חשבון, בלי פרסומות, בלי מעקב.</p>
    </div>
  </section>`;

  const help = root.querySelector('[data-od-help]');
  const odHelp = (v) => {
    help.textContent = v === 'on'
      ? 'הקול לא יוצא מהטלפון. אם אין מודל במכשיר, נקליט בלבד ותדרג את עצמך.'
      : v === 'off'
        ? 'הדפדפן שולח את הקול לשירות שלו כדי להמיר לטקסט. עובד כמעט בכל מקום.'
        : 'על המכשיר כשאפשר. אם לא, שירות הדיבור של הדפדפן.';
  };
  odHelp(set.onDevice);

  const installBtn = root.querySelector('[data-install]');
  const odEl = root.querySelector('[data-od]');
  if (sup.recognition && ctx.S.probeOnDevice) {
    ctx.S.probeOnDevice('en-US').then((r) => {
      odEl.textContent = OD_HE[r] || OD_HE.unknown;
      odEl.className = r === 'yes' ? 'ok' : r === 'no' ? 'no' : '';
      installBtn.hidden = !(r === 'no' && ctx.S.installOnDevice);
    });
  }
  installBtn.addEventListener('click', async () => {
    installBtn.disabled = true;
    installBtn.textContent = 'מוריד...';
    const ok = await ctx.S.installOnDevice('en-US');
    ctx.toast(ok ? 'המודל ירד. מעכשיו הזיהוי יכול לקרות בטלפון.' : 'לא הצלחתי להוריד. נסה שוב מאוחר יותר.', { kind: ok ? 'success' : 'error' });
    if (ok) { ctx.session.micIssue = null; ctx.go('profile'); }
    else { installBtn.disabled = false; installBtn.innerHTML = `${icon('sparkles')} הורד מודל דיבור למכשיר`; }
  });

  const saveName = () => {
    const v = root.querySelector('#pf-name').value.trim().slice(0, 24);
    if (!v) return;
    ctx.set({ name: v });
    ctx.toast(`נעים מאוד, ${v}`, { kind: 'success', iconName: 'smile' });
  };
  on(root, '[data-savename]', 'click', saveName);
  root.querySelector('#pf-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') saveName(); });

  on(root, '[data-theme]', 'click', (e, b) => {
    ctx.set({ settings: { theme: b.dataset.theme } });
    root.querySelectorAll('[data-theme]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  });
  on(root, '[data-toggle]', 'click', (e, b) => {
    const k = b.dataset.toggle;
    const v = !ctx.state.settings[k];
    ctx.set({ settings: { [k]: v } });
    b.setAttribute('aria-checked', String(v));
    if (v && k === 'haptics') ctx.haptic(20);
    if (v && k === 'sound') ctx.sound('good');
  });
  on(root, '[data-od-set]', 'click', (e, b) => {
    const v = b.dataset.odSet;
    ctx.set({ settings: { onDevice: v } });
    ctx.session.micIssue = null;
    root.querySelectorAll('[data-od-set]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    odHelp(v);
  });
  on(root, '[data-reset]', 'click', async () => {
    const ok = await ctx.confirm({ title: 'לאפס הכול?', text: 'כל הנקודות, הרצף, התגים וההיסטוריה יימחקו מהדפדפן הזה.', ok: 'כן, אפס', cancel: 'ביטול', danger: true });
    if (!ok) return;
    const keep = { name: ctx.state.name, settings: ctx.state.settings };
    ctx.store.reset();
    ctx.set({ ...keep, onboarded: true });
    ctx.toast('ההתקדמות אופסה. מתחילים מחדש!', { kind: 'success', iconName: 'rotate' });
    ctx.go('home');
  });
}
