// Profile: three tabs (profile and look, mic and privacy, data). Every change saves at once.
import { esc, on } from './dom.js';
import { icon } from './icons.js';
import { band, ic, ROLES, GOALS, DAILY_MIN, profileOf } from './shell.js';

const OD_HE = { yes: 'מוכן במכשיר', no: 'לא זמין במכשיר', unknown: 'לא ידוע' };
let tab = 'me';

export function render(root, ctx) {
  const st = ctx.state;
  const set = st.settings;
  const sup = ctx.S.support();
  const pf = profileOf(st);
  const tracks = ctx.tracks();
  const aud = ctx.C.AUDIENCES || [];
  const chip = (id, he, on) => `<button class="chip q-chip" data-v="${esc(id)}" aria-pressed="${on}">${on ? icon('check') : ''}<bdi>${esc(he)}</bdi></button>`;

  const sel = (arr) => arr.length ? `<bdi>${arr.length}</bdi> נבחרו` : 'לא נבחר';
  const acc = (key, label, opts, cur) => `<details class="acc pick-acc" data-acc="${key}">
      <summary><span class="grow acc-title">${label}</span><span class="tiny muted" data-count="${key}">${sel(cur)}</span><span class="chev">${icon('chevDown')}</span></summary>
      <div class="pick" data-pick="${key}">${opts.map(([id, he]) => chip(id, he, cur.includes(id))).join('')}</div>
    </details>`;

  root.innerHTML = `<section class="screen profile">
    ${band({ title: 'פרופיל והגדרות', sub: 'שינוי נשמר מיד, רק בדפדפן הזה.' }).replace('class="band"', 'class="band compact"')}
    <div class="body">
      <div class="seg tabs" role="group" aria-label="חלקי הפרופיל">
        <button data-ptab="me" aria-pressed="${tab === 'me'}">פרופיל</button>
        <button data-ptab="mic" aria-pressed="${tab === 'mic'}">מיקרופון ופרטיות</button>
        <button data-ptab="data" aria-pressed="${tab === 'data'}">נתונים</button>
      </div>

      <div class="stack" data-ppanel="me" ${tab === 'me' ? '' : 'hidden'}>
      <div class="card stack-sm" data-testid="profile-form">
        <label class="field"><span class="lbl">השם שלך</span>
          <input class="input" id="pf-name" value="${esc(pf.name || '')}" maxlength="24" autocomplete="given-name">
        </label>
        <div class="field"><span class="lbl">תפקיד</span>
          <div class="pick" data-pick="role" data-one>${ROLES.map(([id, he]) => chip(id, he, pf.role === id)).join('')}</div></div>
        <div class="field"><span class="lbl">יעד יומי</span>
          <div class="seg" role="group" aria-label="יעד יומי בדקות">${DAILY_MIN.map((m) => `<button data-min="${m}" aria-pressed="${pf.dailyGoalMin === m}"><bdi class="en-num">${m}</bdi> דק'</button>`).join('')}</div></div>
        <label class="field"><span class="lbl">ההרצאה הבאה</span>
          <input class="input" type="date" id="pf-date" value="${esc(/^\d{4}-\d{2}-\d{2}$/.test(pf.nextTalkDate || '') ? pf.nextTalkDate : '')}">
        </label>
        <div class="acc-group">
          ${acc('goals', 'בשביל מה אתה מתאמן', GOALS, pf.goals)}
          ${tracks.length ? acc('focusTracks', 'מסלולים בפוקוס', tracks.map((t) => [t.id, t.title_he]), pf.focusTracks) : ''}
          ${aud.length ? acc('audiences', 'מול מי אתה מדבר', aud.map((a) => [a.id, a.name_he]), pf.audiences) : ''}
        </div>
      </div>

      <div class="card stack-sm">
        <h2>${icon('sun', 'h-ic')} מראה ותחושה</h2>
        <div class="seg" role="group" aria-label="ערכת צבעים">
          ${[['system', 'אוטומטי'], ['light', 'בהיר'], ['dark', 'כהה']].map(([v, l]) => `<button data-theme="${v}" aria-pressed="${set.theme === v}">${l}</button>`).join('')}
        </div>
        <div class="switch-row"><span>רטט בתשובות</span><button class="switch" role="switch" aria-checked="${!!set.haptics}" data-toggle="haptics" aria-label="רטט בתשובות"></button></div>
        <div class="switch-row"><span>צלילים</span><button class="switch" role="switch" aria-checked="${!!set.sound}" data-toggle="sound" aria-label="צלילים"></button></div>
      </div>
      </div>

      <div class="stack" data-ppanel="mic" ${tab === 'mic' ? '' : 'hidden'}>
      <div class="card stack-sm">
        <div class="note">${icon('shield')}<span>האפליקציה <b>אף פעם</b> לא שומרת ולא מעלה את הקול שלך. ההקלטה נמצאת רק בזיכרון של הדף, ונמחקת כשאתה עוזב את המסך.</span></div>
        <div class="lbl small">זיהוי דיבור</div>
        <div class="seg" role="group" aria-label="זיהוי על המכשיר">
          ${[['auto', 'אוטומטי'], ['on', 'רק במכשיר'], ['off', 'שירות הדפדפן']].map(([v, l]) => `<button data-od-set="${v}" aria-pressed="${set.onDevice === v}">${l}</button>`).join('')}
        </div>
        <p class="tiny muted" data-od-help></p>
        <button class="btn ghost sm" data-probe hidden>${icon('sparkles')} בדוק זיהוי על המכשיר</button>
        <button class="btn ghost sm" data-install hidden>${icon('sparkles')} הורד מודל דיבור למכשיר</button>
        <details class="acc plain">
          <summary><span class="grow acc-title">פרטים: מה הדפדפן תומך</span><span class="chev">${icon('chevDown')}</span></summary>
          <p class="small">המרת דיבור לטקסט נעשית על ידי הדפדפן. במצב <b>על המכשיר</b> הכול קורה בטלפון. בלי מצב הזה, שירות הדיבור של הדפדפן (ב-Chrome זה Google) מקבל את הקול כדי להפוך אותו לטקסט. זה השירות של הדפדפן, לא שלנו.</p>
          <div class="status-grid small">
            <span>זיהוי דיבור</span><b class="${sup.recognition ? 'ok' : 'no'}">${sup.recognition ? 'נתמך' : 'לא נתמך'}</b>
            <span>על המכשיר</span><b data-od class="${sup.onDevice === 'yes' ? 'ok' : sup.onDevice === 'no' ? 'no' : ''}">${OD_HE[sup.onDevice]}</b>
            <span>הקלטה</span><b class="${sup.recorder ? 'ok' : 'no'}">${sup.recorder ? 'נתמכת' : 'לא נתמכת'}</b>
            <span>חיבור מאובטח</span><b class="${sup.secure ? 'ok' : 'no'}">${sup.secure ? 'כן' : 'לא (המיקרופון צריך https)'}</b>
          </div>
        </details>
      </div>
      </div>

      <div class="stack" data-ppanel="data" ${tab === 'data' ? '' : 'hidden'}>
      <div class="card stack-sm" data-testid="data-card">
        <h2>${ic('download', '', 'h-ic')} גיבוי</h2>
        <p class="small muted">שמור קובץ גיבוי, או טען אותו בטלפון אחר. הקלטות לא נכללות, הן אף פעם לא נשמרות.</p>
        <div class="btn-row">
          <button class="btn line sm" data-save-file data-testid="save-file">${ic('download')} שמור קובץ</button>
          <label class="btn line sm file-btn">${ic('upload')} טען מקובץ<input type="file" accept="application/json,.json" data-load-file class="sr-only" aria-label="טען גיבוי מקובץ"></label>
        </div>
        <details class="acc plain">
          <summary><span class="grow acc-title">העתקה והדבקה של טקסט</span><span class="chev">${icon('chevDown')}</span></summary>
          <div class="stack-sm">
            <div class="btn-row">
              <button class="btn ghost sm" data-export>${ic('copy')} הצג טקסט</button>
              <button class="btn ghost sm" data-copy hidden>${ic('copy')} העתק</button>
            </div>
            <textarea class="textarea mono" id="pf-export" readonly hidden dir="ltr" aria-label="הגיבוי שלך, טקסט JSON" rows="5"></textarea>
            <label class="field"><span class="lbl">הדבק גיבוי</span>
              <textarea class="textarea mono" id="pf-import" dir="ltr" rows="3" placeholder='{"app":"speaker-trainer", ...}' spellcheck="false"></textarea>
            </label>
            <button class="btn ghost sm" data-import>${ic('upload')} ייבא והחלף את הנתונים</button>
          </div>
        </details>
        <p class="note warn" data-import-err role="alert" hidden></p>
      </div>

      <div class="card stack-sm">
        <h2>${icon('trash', 'h-ic')} איפוס</h2>
        <p class="small muted">מוחק נקודות, רצף, תגים והיסטוריה. אי אפשר לבטל.</p>
        <button class="btn line" data-reset style="color:var(--bad);border-color:var(--bad-50)">${icon('trash')} אפס את ההתקדמות</button>
      </div>
      <p class="tiny muted center">Speaker Trainer · בלי חשבון, בלי פרסומות, בלי מעקב.</p>
      </div>
    </div>
  </section>`;

  on(root, '[data-ptab]', 'click', (e, b) => {
    tab = b.dataset.ptab;
    root.querySelectorAll('[data-ptab]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    root.querySelectorAll('[data-ppanel]').forEach((p) => { p.hidden = p.dataset.ppanel !== tab; });
    ctx.haptic(8);
  });

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
  // The on-device probe runs only on a tap (2026-10-21): an automatic probe
  // crashed a headless Chromium page, so it must never run on render.
  const probeBtn = root.querySelector('[data-probe]');
  const showOd = (r) => {
    odEl.textContent = OD_HE[r] || OD_HE.unknown;
    odEl.className = r === 'yes' ? 'ok' : r === 'no' ? 'no' : '';
    installBtn.hidden = !(r === 'no' && ctx.S.installOnDevice);
  };
  const cached = ctx.S.cachedOnDevice ? ctx.S.cachedOnDevice('en-US') : null;
  if (cached) showOd(cached);
  if (sup.recognition && ctx.S.probeOnDevice) {
    probeBtn.hidden = !!cached && cached !== 'unknown';
    probeBtn.addEventListener('click', async () => {
      probeBtn.disabled = true;
      const r = await ctx.S.probeOnDevice('en-US');
      showOd(r);
      probeBtn.hidden = r !== 'unknown';
      probeBtn.disabled = false;
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

  // One save model: every change saves at once (the name after a short pause) and shows a small "נשמר".
  const draft = { role: pf.role, goals: [...pf.goals], focusTracks: [...pf.focusTracks], audiences: [...pf.audiences], dailyGoalMin: pf.dailyGoalMin };
  let lastToast = 0;
  const saved = () => {
    const now = Date.now();
    if (now - lastToast > 1500) ctx.toast('נשמר', { kind: 'success', iconName: 'check', ms: 1200 });
    lastToast = now;
  };
  const save = (patch) => { ctx.saveProfile(patch); saved(); };
  on(root, '.pick [data-v]', 'click', (e, b) => {
    const box = b.closest('[data-pick]');
    const key = box.dataset.pick;
    const v = b.dataset.v;
    if (box.hasAttribute('data-one')) draft[key] = draft[key] === v ? '' : v;
    else draft[key] = draft[key].includes(v) ? draft[key].filter((x) => x !== v) : [...draft[key], v];
    box.querySelectorAll('[data-v]').forEach((x) => {
      const onNow = box.hasAttribute('data-one') ? draft[key] === x.dataset.v : draft[key].includes(x.dataset.v);
      x.setAttribute('aria-pressed', String(onNow));
      x.innerHTML = `${onNow ? icon('check') : ''}<bdi>${x.querySelector('bdi').innerHTML}</bdi>`;
    });
    const cnt = root.querySelector(`[data-count="${key}"]`);
    if (cnt) cnt.innerHTML = sel(draft[key]);
    ctx.haptic(8);
    save({ [key]: draft[key] });
  });
  on(root, '[data-min]', 'click', (e, b) => {
    draft.dailyGoalMin = Number(b.dataset.min);
    root.querySelectorAll('[data-min]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    save({ dailyGoalMin: draft.dailyGoalMin });
  });
  const nameEl = root.querySelector('#pf-name');
  let nameT = 0;
  let nameDirty = false;
  const saveName = () => {
    clearTimeout(nameT);
    if (!nameDirty) return;
    nameDirty = false;
    const name = nameEl.value.trim().slice(0, 24);
    ctx.saveProfile({ name });
    ctx.set({ name });
    saved();
  };
  nameEl.addEventListener('input', () => { nameDirty = true; clearTimeout(nameT); nameT = setTimeout(saveName, 600); });
  nameEl.addEventListener('blur', saveName);
  nameEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); } });
  root.querySelector('#pf-date').addEventListener('change', (e) => save({ nextTalkDate: e.target.value || null }));
  // Leaving the screen never drops an edit.
  ctx.onLeave(saveName);

  // Export and import.
  const out = root.querySelector('#pf-export');
  const copyBtn = root.querySelector('[data-copy]');
  on(root, '[data-export]', 'click', () => {
    out.value = ctx.exportData();
    out.hidden = false;
    copyBtn.hidden = false;
    out.focus();
    out.select();
  });
  on(root, '[data-copy]', 'click', async () => {
    let ok = false;
    try { await navigator.clipboard.writeText(out.value); ok = true; } catch {
      try { out.select(); ok = document.execCommand('copy'); } catch { ok = false; }
    }
    ctx.toast(ok ? 'הגיבוי הועתק. שמור אותו במקום בטוח.' : 'לא הצלחתי להעתיק. סמן את הטקסט והעתק ידנית.', { kind: ok ? 'success' : 'warn' });
  });
  const err = root.querySelector('[data-import-err]');
  on(root, '[data-save-file]', 'click', () => {
    try {
      const blob = new Blob([ctx.exportData()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `speaker-trainer-backup-${ctx.E.todayStr()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      ctx.toast('קובץ הגיבוי נשמר בהורדות.', { kind: 'success' });
    } catch {
      ctx.toast('לא הצלחתי לשמור קובץ. נסה העתקה והדבקה.', { kind: 'warn' });
    }
  });
  const importText = async (text) => {
    err.hidden = true;
    if (!text.trim()) { err.textContent = 'הדבק קודם את טקסט הגיבוי.'; err.hidden = false; return; }
    try { JSON.parse(text); } catch { err.textContent = 'זה לא גיבוי תקין. בדוק שבחרת את הקובץ הנכון, או שהעתקת את כל הטקסט.'; err.hidden = false; return; }
    const ok = await ctx.confirm({ title: 'להחליף את הנתונים?', text: 'הגיבוי יחליף את כל ההתקדמות בדפדפן הזה.', ok: 'כן, ייבא', cancel: 'ביטול', danger: true });
    if (!ok) return;
    try {
      ctx.importData(text);
    } catch (e) {
      err.textContent = (e && e.message) || 'הייבוא נכשל.';
      err.hidden = false;
      return;
    }
    ctx.toast('הנתונים יובאו. ברוך שובך!', { kind: 'success' });
    ctx.go('home');
  };
  root.querySelector('[data-load-file]').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { err.textContent = 'הקובץ גדול מדי לגיבוי.'; err.hidden = false; return; }
    importText(await f.text());
  });
  on(root, '[data-import]', 'click', () => importText(root.querySelector('#pf-import').value));

  on(root, '[data-theme]', 'click', (e, b) => {
    ctx.set({ settings: { theme: b.dataset.theme } });
    root.querySelectorAll('[data-theme]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    saved();
  });
  on(root, '[data-toggle]', 'click', (e, b) => {
    const k = b.dataset.toggle;
    const v = !ctx.state.settings[k];
    ctx.set({ settings: { [k]: v } });
    b.setAttribute('aria-checked', String(v));
    if (v && k === 'haptics') ctx.haptic(20);
    if (v && k === 'sound') ctx.sound('good');
    saved();
  });
  on(root, '[data-od-set]', 'click', (e, b) => {
    const v = b.dataset.odSet;
    ctx.set({ settings: { onDevice: v } });
    ctx.session.micIssue = null;
    root.querySelectorAll('[data-od-set]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    odHelp(v);
    saved();
  });
  on(root, '[data-reset]', 'click', async () => {
    const ok = await ctx.confirm({ title: 'לאפס הכול?', text: 'כל הנקודות, הרצף, התגים וההיסטוריה יימחקו מהדפדפן הזה.', ok: 'כן, אפס', cancel: 'ביטול', danger: true });
    if (!ok) return;
    const keep = { name: ctx.state.name, settings: ctx.state.settings, ...(ctx.state.profile ? { profile: ctx.state.profile } : {}) };
    ctx.store.reset();
    ctx.set({ ...keep, onboarded: true });
    ctx.toast('ההתקדמות אופסה. מתחילים מחדש!', { kind: 'success', iconName: 'rotate' });
    ctx.go('home');
  });
}
