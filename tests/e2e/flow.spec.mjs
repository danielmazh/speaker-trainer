// Core game flow: onboarding, full daily mission (fake mic and no-mic fallbacks), result, XP, streak.
// Selectors: data-testid in qa-owned screens, role and text in screens owned by others.
import { test, expect, onboard, seed, fresh, state, tasksOf, playMission, speak, itemsById, dismissModals, noHScroll, a11y, SCRIPT, DAY_A, DAY_B } from './fixtures.mjs';

const streakPill = (page) => page.getByRole('link', { name: /רצף/ }).first();

test.describe('first run', () => {
  test('onboarding leads to home and is not shown again', async ({ page }) => {
    await onboard(page, 'Noa');
    const st = await state(page);
    expect(st.onboarded).toBe(true);
    expect(JSON.stringify(st)).toContain('Noa');
    await expect(page.getByTestId('greet')).toHaveText('היי, Noa');
    await expect(page.getByRole('navigation')).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(/#home$/);
  });

  test('skip finishes onboarding', async ({ page }) => {
    await fresh(page);
    await expect(page).toHaveURL(/#onboarding$/);
    await expect(page.locator('#ob-name')).toHaveValue('');
    for (let i = 0; i < 6 && !/#home$/.test(page.url()); i++) {
      await page.getByRole('button', { name: /דלג/ }).first().click();
      await page.waitForTimeout(150);
    }
    await expect(page).toHaveURL(/#home$/);
    const st = await state(page);
    expect(st.onboarded).toBe(true);
    expect(st.name).toBe('');
    expect(st.profile.name).toBe('');
    await expect(page.getByTestId('greet')).toHaveText('היי!');
    await expect(page.locator('body')).not.toContainText('Daniel');
  });
});

for (const mode of ['mic', 'nomic']) {
  for (const [dayName, day, boss] of [['day A', DAY_A, 'recall'], ['day B', DAY_B, 'qa']]) {
    test.describe(`full mission, ${mode}, ${dayName}`, () => {
      test.use({ micMode: mode, fixedDate: day });
      test(`all 5 tasks (${boss} boss), result, XP, streak, mission modal, persists after reload`, async ({ page }) => {
        await seed(page);
        await page.goto('?nosw#mission');
        await page.getByTestId('mission-start').click();
        await expect(page).toHaveURL(/#play$/);
        await page.getByTestId('play-close').click(); // nothing done yet: leaves without a confirm
        await expect(page).toHaveURL(/#mission$/);
        const { seenTypes } = await playMission(page, mode);
        expect(seenTypes).toEqual(expect.arrayContaining(['shadow', 'fix', 'choice', 'speak']));
        expect(seenTypes.at(-1)).toBe(boss);

        const st = await state(page);
        expect(st.daily.done).toHaveLength(5);
        expect(st.daily.bonus).toBe(true);
        expect(st.xp).toBeGreaterThan(0);
        expect(st.streak.count).toBe(1);
        expect(st.days).toContain(st.daily.date);
        // Privacy: no transcript text or audio in storage. Metrics carry words and wpm.
        const raw = await page.evaluate(() => localStorage.getItem('speakerTrainer.v1'));
        expect(raw).not.toContain('blob:');
        expect(raw).not.toContain('basically we gonna');
        const hist = st.history.filter((h) => h.metrics && h.metrics.mode !== 'tap');
        expect(hist.length).toBeGreaterThan(0);
        for (const h of hist) { expect(typeof h.metrics.words).toBe('number'); expect(typeof h.metrics.wpm).toBe('number'); }
        if (mode === 'mic') expect(st.history.some((h) => h.metrics && h.metrics.fromMic && h.metrics.words > 0)).toBe(true);
        else expect(st.history.every((h) => !h.metrics || !h.metrics.fromMic)).toBe(true);

        // Last result: home button, no "next".
        await expect(page.getByTestId('result-next')).toHaveCount(0);
        await expect(page.getByTestId('result-home')).toBeVisible();
        await expect(page.getByTestId('mission-done')).toBeVisible();

        await page.reload();
        await page.goto('?nosw#home');
        await expect(streakPill(page)).toContainText('1');
        await expect(page.getByTestId('mission-hero')).toContainText('המשימה הושלמה!');
        await page.goto('?nosw#mission');
        await expect(page.locator('[data-testid="mission-node"][data-status="done"]')).toHaveCount(5);
        await expect(page.getByTestId('mission-finished')).toBeVisible();
      });
    });
  }
}

test.describe('speak task with the fake mic', () => {
  test.use({ micMode: 'mic', fixedDate: DAY_A });

  test('live transcript marks fillers, result shows score and filler bars', async ({ page }) => {
    await seed(page);
    const tasks = await tasksOf(page);
    const speakTask = tasks.find((t) => t.kind === 'speak');
    await page.goto('?nosw#mission');
    // Later steps are locked.
    await page.locator(`[data-task="${speakTask.id}"]`).click();
    await expect(page.getByRole('status').locator('.toast')).toBeVisible();
    await expect(page).toHaveURL(/#mission$/);
    await page.evaluate((id) => {
      const s = JSON.parse(localStorage.getItem('speakerTrainer.v1'));
      s.daily.done = s.daily.tasks.filter((t) => t.id !== id && t.kind !== 'boss').map((t) => t.id);
      localStorage.setItem('speakerTrainer.v1', JSON.stringify(s));
    }, speakTask.id);
    await page.reload();
    await page.getByTestId('mission-start').click();
    await expect(page.getByTestId('play-kicker')).toContainText('שלב 4 מתוך 5');
    await expect(page.locator('[data-timer]')).toBeVisible();

    const stage = page.getByTestId('stage');
    await page.evaluate((t) => { window.__fake.text = t; window.__fake.stepMs = 150; }, SCRIPT);
    // Compact mic block (mic, status, type and rate actions): fits a sticky dock at 360x740.
    expect((await stage.getByTestId('mic-block').boundingBox()).height).toBeLessThanOrEqual(180);
    await stage.getByTestId('mic').click();
    await expect(stage.locator('.mic')).toHaveAttribute('data-state', 'listening');
    await expect(stage.getByText('בשידור')).toBeVisible();
    await expect(stage.getByTestId('transcript').locator('mark.hl-filler').first()).toBeVisible();
    await expect(stage.getByTestId('transcript').locator('mark.hl-bedrop')).toHaveCount(1); // "we gonna"
    await page.waitForFunction(() => document.querySelector('[data-testid="transcript"]').textContent.includes('fast'));
    await expect(stage.locator('.counter[data-k="fpm"] b')).not.toHaveText('0');
    await stage.getByTestId('mic').click();
    await expect(page.getByTestId('feedback-next')).toBeVisible();
    await page.getByTestId('feedback-next').click();

    const res = page.getByTestId('result');
    await expect(res).toBeVisible();
    await page.waitForTimeout(1300);
    const score = Number(await res.getByTestId('score').textContent());
    expect(score).toBeGreaterThanOrEqual(0); // fillers, a be-drop and no must-say phrases: a low score is right
    expect(score).toBeLessThanOrEqual(100);
    const rows = res.getByTestId('filler-rows');
    await expect(rows).toHaveAttribute('dir', 'ltr');
    const words = await rows.locator('.fw').allTextContents();
    expect(words).toEqual(expect.arrayContaining(['so', 'basically', 'um']));
    // In-memory playback only. On mobile, recognition alone owns the mic, so a speech take has no recording.
    const mobile = await page.evaluate(async () => (await import('./js/speech.js')).platform().mobile);
    await expect(res.getByTestId('playback')).toHaveCount(mobile ? 0 : 1);
    // Mobile: the take never opened getUserMedia (no fight with recognition). Desktop: one stream.
    expect(await page.evaluate(() => window.__fake.gum)).toBe(mobile ? 0 : 1);
    await expect(res.getByTestId('xp-gained')).not.toHaveText('0');
    const last = (await state(page)).history.at(-1);
    expect(last.metrics.fillerTotal).toBeGreaterThanOrEqual(3);
    expect(last.metrics.fillers).toMatchObject({ so: 1, basically: 1, um: 1 });
    expect(last.metrics.wpm).toBeGreaterThan(0);
    await dismissModals(page, 1500);
  });

  test('hidden page during a take ends it and shows the result', async ({ page }) => {
    await seed(page);
    const byId = await itemsById(page);
    const tasks = await tasksOf(page);
    await page.goto('?nosw#mission');
    await page.getByTestId('mission-start').click();
    const it = byId[tasks[0].itemIds[0]];
    await page.evaluate((t) => { window.__fake.text = t; window.__fake.stepMs = 80; }, it.sentence_en);
    await page.getByTestId('stage').getByTestId('mic').click();
    await page.waitForFunction(() => document.querySelector('[data-testid="transcript"]').textContent.trim().split(/\s+/).length >= 2);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(page.getByTestId('feedback-next')).toBeVisible();
    await expect(page.getByTestId('stage').locator('.mic')).toHaveAttribute('data-state', 'done');
  });

  test('retry, exit confirm, coach practice', async ({ page }) => {
    await seed(page);
    const byId = await itemsById(page);
    const tasks = await tasksOf(page);
    await page.goto('?nosw#mission');
    await page.getByTestId('mission-start').click();
    const it = byId[tasks[0].itemIds[0]];
    await speak(page, it.sentence_en);
    await page.getByTestId('retry').click();
    await expect(page.getByTestId('feedback')).toBeEmpty();
    await speak(page, it.sentence_en);
    await page.getByTestId('feedback-next').click();
    // Exit mid task: in-page confirm, "stay" keeps us here.
    await page.getByTestId('play-close').click();
    const dlg = page.getByRole('dialog');
    await expect(dlg).toBeVisible();
    await dlg.getByRole('button', { name: 'להישאר' }).click();
    await expect(page).toHaveURL(/#play$/);
    await page.getByTestId('play-close').click();
    await dlg.getByRole('button', { name: 'לצאת' }).click();
    await expect(page).toHaveURL(/#mission$/);
    expect((await state(page)).daily.done).toHaveLength(0);
  });
});

test.describe('streak across days', () => {
  test('two days in a row make a streak of 2', async ({ page }) => {
    await page.clock.setFixedTime(new Date(DAY_A));
    await seed(page);
    const byId = await itemsById(page);
    const playFirst = async () => {
      const tasks = await tasksOf(page);
      await page.goto('?nosw#mission');
      await page.getByTestId('mission-start').click();
      for (const id of tasks[0].itemIds) {
        await speak(page, byId[id].sentence_en);
        await page.getByTestId('feedback-next').click();
      }
      await expect(page.getByTestId('result')).toBeVisible();
      await dismissModals(page, 1500);
    };
    await playFirst();
    expect((await state(page)).streak.count).toBe(1);
    await page.clock.setFixedTime(new Date(DAY_B));
    await page.goto('?nosw#home');
    await page.reload();
    const st2 = await state(page);
    expect(st2.daily.date).toBe('2026-10-22');
    expect(st2.daily.done).toHaveLength(0);
    await playFirst();
    expect((await state(page)).streak.count).toBe(2);
    await page.goto('?nosw#home');
    await expect(streakPill(page)).toContainText('2');
    await noHScroll(page, 'home day 2');
    await a11y(page, 'home day 2');
  });
});

test.describe('word stress choice', () => {
  test.use({ fixedDate: DAY_A });
  test('stress items show the word neutral, not as a mistake', async ({ page }) => {
    await seed(page);
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('speakerTrainer.v1'));
      s.daily.done = s.daily.tasks.filter((t) => t.kind === 'warmup' || t.kind === 'fix').map((t) => t.id);
      s.daily.tasks.find((t) => t.kind === 'choice').itemIds = ['ws-029'];
      localStorage.setItem('speakerTrainer.v1', JSON.stringify(s));
    });
    await page.reload();
    await page.goto('?nosw#mission');
    await page.getByTestId('mission-start').click();
    const prompt = page.getByTestId('choice-prompt');
    await expect(prompt).toHaveClass(/quote-neutral/);
    await expect(page.getByText('איפה הדגש?')).toBeVisible();
    await page.getByTestId('stage').locator('.opt').first().click();
    await expect(page.getByTestId('feedback-next')).toBeVisible();
  });
});
