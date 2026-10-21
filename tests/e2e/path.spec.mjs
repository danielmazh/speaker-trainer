// Skill path: pick a track, play unit 1 with good answers, unit 2 opens.
import { test, expect, seed, state, itemsById, playItem, dismissModals, noHScroll, a11y, DAY_A } from './fixtures.mjs';

test.use({ fixedDate: DAY_A, micMode: 'mic' });

test('track: start unit 1, finish it, unit 2 opens', async ({ page }) => {
  test.setTimeout(300_000);
  await seed(page);
  const byId = await itemsById(page);
  await page.goto('?nosw#path');
  const path = page.getByTestId('path');
  await expect(path).toBeVisible();
  await noHScroll(page, 'path');
  await a11y(page, 'path');
  await path.getByRole('button', { name: /יחידות/ }).first().click();
  await expect(page).toHaveURL(/#track$/);
  const track = page.getByTestId('track');
  await expect(track).toBeVisible();
  await noHScroll(page, 'track');
  await a11y(page, 'track');
  // Unit 2 is locked at the start.
  await expect(track.getByRole('button', { name: /^יחידה 2:.*נעולה/ })).toBeVisible();
  await track.getByRole('button', { name: /^יחידה 1:/ }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: /התחל יחידה/ }).click();
  await expect(page).toHaveURL(/#play$/);

  // Play each item until the result screen, all answers right.
  for (let n = 0; n < 20; n++) {
    await expect(page.getByTestId('result').or(page.getByTestId('stage'))).toBeVisible();
    if (await page.getByTestId('result').isVisible()) break;
    const it = await page.evaluate(() => document.querySelector('[data-testid="stage"]')?.dataset.item || null);
    expect(it, 'stage carries the item id').toBeTruthy();
    await playItem(page, byId[it], 0, 'mic', { allRight: true });
    await page.getByTestId('feedback-next').click();
  }
  const res = page.getByTestId('result');
  await expect(res).toBeVisible();
  await expect(res.getByTestId('unit-done')).toBeVisible();
  await expect(res.getByTestId('result-next')).toHaveCount(0);
  await dismissModals(page, 2500);
  await res.getByTestId('result-track').click();
  await expect(page).toHaveURL(/#track$/);
  await expect(track.getByRole('button', { name: /^יחידה 1:.*הושלמה/ })).toBeVisible();
  await expect(track.getByRole('button', { name: /^יחידה 2:.*פתוחה/ })).toBeVisible();
  const st = await state(page);
  expect(Object.values(st.tracks || {}).some((u) => u && u.bossPassed)).toBe(true);
});

test('closing a unit goes back to the track', async ({ page }) => {
  await seed(page);
  await page.goto('?nosw#path');
  await page.getByTestId('path').getByRole('button', { name: /יחידות/ }).first().click();
  await page.getByTestId('track').getByRole('button', { name: /^יחידה 1:/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: /התחל יחידה/ }).click();
  await expect(page).toHaveURL(/#play$/);
  await page.getByTestId('play-close').click();
  await expect(page).toHaveURL(/#track$/);
});
