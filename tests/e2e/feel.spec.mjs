// Game feel: transitions, press states, guarded haptics, sound only after a gesture, reduced motion.
import { test, expect, seed, tasksOf, itemsById, speak, playItem, DAY_A } from './fixtures.mjs';

test.use({ fixedDate: DAY_A });

test('no audio before a user gesture; sounds and haptics after answers', async ({ page }) => {
  await seed(page);
  for (const r of ['home', 'mission', 'coach', 'stats', 'profile']) await page.goto(`?nosw#${r}`);
  expect(await page.evaluate(() => window.__audioBeforeGesture)).toBe(0);
  const byId = await itemsById(page);
  const tasks = await tasksOf(page);
  await page.goto('?nosw#mission');
  await page.getByTestId('mission-start').click();
  await page.evaluate(() => { window.__vibes.length = 0; });
  await speak(page, byId[tasks[0].itemIds[0]].sentence_en);
  await expect(page.getByTestId('feedback-next')).toBeVisible();
  expect(await page.evaluate(() => window.__vibes.length)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__audioBeforeGesture)).toBe(0);
  expect(await page.evaluate(() => window.__audioCtx)).toBeGreaterThan(0);
});

test('haptics and sound never throw when the APIs fail', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'vibrate', { configurable: true, value() { throw new Error('no vibrate'); } });
    window.AudioContext = function Broken() { throw new Error('no audio'); };
    window.webkitAudioContext = window.AudioContext;
  });
  await seed(page);
  const tasks = await tasksOf(page);
  const byId = await itemsById(page);
  // Choice task: tap answers, which call sound + haptic.
  await page.evaluate((id) => {
    const s = JSON.parse(localStorage.getItem('speakerTrainer.v1'));
    s.daily.done = s.daily.tasks.filter((t) => t.kind === 'warmup' || t.kind === 'fix').map((t) => t.id);
    localStorage.setItem('speakerTrainer.v1', JSON.stringify(s));
  });
  await page.reload();
  await page.goto('?nosw#mission');
  await page.getByTestId('mission-start').click();
  const choice = tasks.find((t) => t.kind === 'choice');
  await playItem(page, byId[choice.itemIds[0]], 0, 'mic');
  await expect(page.getByTestId('feedback-next')).toBeVisible();
});

test('screen and item transitions animate; buttons have a press state', async ({ page }) => {
  await seed(page);
  await page.goto('?nosw#coach');
  const info = await page.evaluate(() => {
    const out = {};
    const view = document.querySelector('.screen');
    out.screenAnim = view ? getComputedStyle(view).animationName : 'none';
    const btn = document.querySelector('.btn');
    out.btnTransition = btn ? getComputedStyle(btn).transitionProperty : '';
    // :active rules for buttons exist in the CSS.
    out.activeRules = [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules]; } catch { return []; } })
      .filter((r) => r.selectorText && /:active/.test(r.selectorText)).map((r) => r.selectorText);
    return out;
  });
  expect(info.screenAnim).not.toBe('none');
  expect(info.btnTransition).toMatch(/transform|all/);
  expect(info.activeRules.some((s) => /\.btn/.test(s))).toBe(true);
  expect(info.activeRules.some((s) => /\.opt/.test(s))).toBe(true);
  expect(info.activeRules.some((s) => /mic-core/.test(s))).toBe(true);
  await page.goto('?nosw#mission');
  await page.getByTestId('mission-start').click();
  const stageAnim = await page.getByTestId('stage').evaluate((el) => getComputedStyle(el).animationName);
  expect(stageAnim).not.toBe('none');
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('no confetti, no long animations, numbers show final values at once', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seed(page);
    const tasks = await tasksOf(page);
    const byId = await itemsById(page);
    await page.goto('?nosw#coach');
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
    const dur = await page.evaluate(() => {
      const el = document.querySelector('.screen');
      return parseFloat(getComputedStyle(el).animationDuration) || 0;
    });
    expect(dur).toBeLessThan(0.01);
    await page.evaluate(() => {
      window.__confetti = 0;
      new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeName === 'CANVAS') window.__confetti++; }))).observe(document.body, { childList: true });
    });
    await page.goto('?nosw#mission');
    await page.getByTestId('mission-start').click();
    for (const id of tasks[0].itemIds) {
      await speak(page, byId[id].sentence_en);
      await page.getByTestId('feedback-next').click();
    }
    const res = page.getByTestId('result');
    await expect(res).toBeVisible();
    const n = await res.getByTestId('score').textContent();
    await page.waitForTimeout(100);
    expect(await res.getByTestId('score').textContent()).toBe(n); // no count-up
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => window.__confetti)).toBe(0);
  });
});
