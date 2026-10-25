// Every screen: a11y basics, no horizontal scroll, dark mode, coach, stats, profile, reset.
// Screenshots go to SHOTS_DIR (default test-results/screens/<project>).
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, seed, fresh, state, playMission, noHScroll, a11y, DAY_A } from './fixtures.mjs';

const shooter = (page, info, suffix = '') => {
  const dir = join(process.env.SHOTS_DIR || 'test-results/screens', info.project.name + suffix);
  mkdirSync(dir, { recursive: true });
  return async (name, full = false) => {
    await page.waitForTimeout(350);
    await page.screenshot({ path: join(dir, `${name}.png`), fullPage: full, animations: 'disabled', caret: 'hide' });
  };
};

// Known routes; new screens (path, track) are picked up from the nav links too.
const ROUTES = ['home', 'mission', 'coach', 'stats', 'profile'];

for (const scheme of ['light', 'dark']) {
  test.describe(`all screens, ${scheme}`, () => {
    test.use({ colorScheme: scheme, fixedDate: DAY_A, micMode: 'mic' });
    test('a11y, no horizontal scroll, theme colors, screenshots', async ({ page }, info) => {
      const shot = shooter(page, info, scheme === 'dark' ? '-dark' : '');
      await fresh(page);
      await expect(page).toHaveURL(/#onboarding$/);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      await noHScroll(page, 'onboarding');
      await a11y(page, 'onboarding');
      await shot('01-onboarding');
      await seed(page);
      const navRoutes = await page.getByRole('navigation').locator('a[href^="#"]').evaluateAll((as) => as.map((a) => a.getAttribute('href').slice(1)));
      const routes = [...new Set([...ROUTES, ...navRoutes.filter((r) => r && r !== 'play')])];
      for (const [k, r] of routes.entries()) {
        await page.goto(`?nosw#${r}`);
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
        await noHScroll(page, r);
        await a11y(page, r);
        await shot(`${String(k + 2).padStart(2, '0')}-${r}`);
      }
      const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      expect(bg).toBe(scheme === 'dark' ? 'rgb(18, 13, 36)' : 'rgb(246, 243, 255)');

      // Play the whole mission, checking each task screen too.
      const check = async (name) => {
        await noHScroll(page, name);
        await a11y(page, name);
        await shot(name);
      };
      await playMission(page, 'mic', { shots: check });
      await check('result-final');
      await page.goto('?nosw#home');
      await check('home-after');
      await page.goto('?nosw#stats');
      await check('stats-after');
      await shot('stats-after-full', true);
    });
  });
}

test.describe('coach', () => {
  test('audience switch, new icebreaker, tips and practice', async ({ page }) => {
    await seed(page);
    await page.goto('?nosw#coach');
    const segs = page.getByTestId('audiences').getByRole('button');
    expect(await segs.count()).toBeGreaterThanOrEqual(2);
    await expect(segs.first()).toHaveAttribute('aria-pressed', 'true');
    const plan = page.getByTestId('audience-plan');
    const firstTitle = await plan.getByRole('heading').first().textContent();
    await segs.nth(1).click();
    await expect(segs.nth(1)).toHaveAttribute('aria-pressed', 'true');
    await expect(segs.first()).toHaveAttribute('aria-pressed', 'false');
    await expect(plan.getByRole('heading').first()).not.toHaveText(firstTitle);
    expect(await page.evaluate(() => window.__vibes.length)).toBeGreaterThan(0);

    await page.getByRole('button', { name: 'פתיח', exact: true }).click();
    const ice = page.getByTestId('icebreaker');
    const before = await ice.textContent();
    await page.getByTestId('new-icebreaker').click();
    await expect(ice).not.toHaveText(before);
    await expect(ice.locator('[lang="en"]').first()).toHaveAttribute('dir', 'ltr');

    await page.getByRole('button', { name: 'טיפים', exact: true }).click();
    const acc = page.locator('details').first();
    await acc.locator('summary').click();
    await expect(acc).toHaveAttribute('open', '');
    await acc.getByRole('button', { name: /תרגל/ }).click();
    await expect(page).toHaveURL(/#play$/);
    await expect(page.getByTestId('play-kicker')).toContainText('תרגול');
    await noHScroll(page, 'coach practice');
  });
});

test.describe('stats and profile', () => {
  test('stats renders; profile theme, haptics and reset with in-page confirm', async ({ page }) => {
    await seed(page, 'Maya');
    await page.goto('?nosw#stats');
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await expect(page.getByText(/תגים/).first()).toBeVisible();
    await page.goto('?nosw#profile');

    // Theme switch applies at once and survives reload.
    await page.getByRole('button', { name: 'כהה', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(18, 13, 36)');
    await page.getByRole('button', { name: 'אוטומטי', exact: true }).first().click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /./);

    // Haptics off: no vibrate calls after that (checked on the coach screen).
    const sw = page.getByRole('switch', { name: /רטט/ });
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'false');
    await page.goto('?nosw#coach');
    await page.evaluate(() => { window.__vibes.length = 0; });
    await page.getByTestId('audiences').getByRole('button').nth(1).click();
    expect(await page.evaluate(() => window.__vibes.length)).toBe(0);
    await page.goto('?nosw#profile');
    await page.getByRole('switch', { name: /רטט/ }).click();

    // Some progress, then reset. Escape cancels; confirm resets.
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('speakerTrainer.v1'));
      s.xp = 340; s.streak = { ...s.streak, count: 3, last: s.daily.date, best: 3 };
      localStorage.setItem('speakerTrainer.v1', JSON.stringify(s));
    });
    await page.reload();
    await page.getByRole('button', { name: 'נתונים', exact: true }).click();
    const reset = page.getByRole('button', { name: /אפס/ }).first();
    await reset.click();
    const dlg = page.getByRole('dialog');
    await expect(dlg).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dlg).toHaveCount(0);
    expect((await state(page)).xp).toBe(340);
    await reset.click();
    await dlg.getByRole('button', { name: /אפס/ }).click();
    await expect(page).toHaveURL(/#home$/);
    const st = await state(page);
    expect(st.xp).toBe(0);
    expect(st.streak.count || 0).toBe(0);
    expect(st.onboarded).toBe(true);
    expect(JSON.stringify(st)).toContain('Maya');
  });
});

test.describe('keyboard and focus', () => {
  test('skip link shows on focus, focus ring on controls', async ({ page }) => {
    await seed(page);
    await page.goto('?nosw#coach');
    const skip = page.locator('a[href="#view"]');
    await skip.focus();
    await expect(skip).toBeInViewport();
    let seen = 0;
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      const ring = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body || !el.matches(':focus-visible')) return null;
        const cs = getComputedStyle(el);
        return { tag: el.tagName + '.' + el.className, outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2, shadow: cs.boxShadow !== 'none' };
      });
      if (!ring) continue;
      expect(ring.outline || ring.shadow, `focus ring on ${ring.tag}`).toBe(true);
      seen++;
    }
    expect(seen).toBeGreaterThan(4);
  });

  test('modal traps focus, Escape closes and returns focus', async ({ page }) => {
    await seed(page);
    await page.goto('?nosw#profile');
    await page.getByRole('button', { name: 'נתונים', exact: true }).click();
    const btn = page.getByRole('button', { name: /אפס/ }).first();
    await btn.focus();
    await page.keyboard.press('Enter');
    const dlg = page.getByRole('dialog');
    await expect(dlg).toBeVisible();
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement.closest('[role="dialog"]'))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(btn).toBeFocused();
  });
});

test.describe('profile auto-save', () => {
  test('edits save on change, also when leaving the screen at once', async ({ page }) => {
    await seed(page, 'Maya');
    await page.goto('?nosw#profile');
    await page.getByRole('button', { name: /ראש צוות/ }).click();
    await page.getByLabel('השם שלך').fill('Dana');
    await page.goto('?nosw#stats'); // hash route change right after typing
    await expect.poll(async () => (await state(page)).profile.role).toBe('lead');
    await page.goto('?nosw#profile');
    await page.getByLabel('השם שלך').fill('Noa');
    await page.getByRole('navigation').getByRole('link').first().click();
    await expect.poll(async () => (await state(page)).name).toBe('Noa');
  });
});
