// Onboarding: 3 swipeable slides, first run only.
import { esc } from './dom.js';
import { icon } from './icons.js';
import { artSpeaker, artMap, artShield } from './art.js';

const SLIDES = [
  { art: () => artSpeaker(300), title: 'Speaker Trainer', en: true, text: 'רק 12 דקות ביום. מדברים אנגלית טכנית בביטחון, בלי מילות מילוי.',
    pills: `<span class="float-pill p1"><span class="gold-ic">${icon('starLine')}</span><bdi class="en-num">+20 XP</bdi></span><span class="float-pill p2"><bdi class="en-num">7</bdi><span class="flame-ic">${icon('flameLine')}</span></span>` },
  { art: () => artMap(220), title: 'משימה חדשה כל יום', text: '5 שלבים קצרים: חימום, תיקון, בחירה, דיבור ובוס. מה שקשה לך חוזר יותר.', pills: '' },
  { art: () => artShield(220), title: 'הקול שלך נשאר אצלך', text: 'האפליקציה לא שומרת ולא מעלה הקלטות. בלי מיקרופון? אפשר להקליד או לדרג את עצמך.', pills: '' },
];

export function render(root, ctx) {
  const name = ctx.state.name || 'Daniel';
  root.innerHTML = `<section class="screen no-nav onboarding">
    <div class="ob-top"><button class="link-btn" data-skip>דלג</button></div>
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

  const finish = () => {
    const v = (root.querySelector('#ob-name')?.value || '').trim();
    ctx.set({ onboarded: true, ...(v ? { name: v.slice(0, 24) } : {}) });
    ctx.haptic(20);
    ctx.go('home');
  };
  nextBtn.addEventListener('click', () => (cur < SLIDES.length - 1 ? go(cur + 1) : finish()));
  root.querySelector('[data-skip]').addEventListener('click', finish);
}
