// The About tab shows the copyright notice.
import { test, expect } from './fixtures.mjs';

test('profile About tab shows copyright and version', async ({ page }) => {
  await page.goto('./#home');
  await page.evaluate(() => { localStorage.setItem('speakerTrainer.v1', JSON.stringify({ v: 1, onboarded: true, name: 'Alex' })); });
  await page.reload();
  await page.getByRole('link', { name: 'פרופיל והגדרות' }).click();
  await page.getByTestId('tab-about').click();
  const about = page.getByTestId('about');
  await expect(about).toBeVisible();
  await expect(about.getByText(/Daniel Mazhbits/)).toBeVisible();
  await expect(about.getByText(/כל הזכויות שמורות/)).toBeVisible();
  await expect(about.getByText(/3\.1\.0/)).toBeVisible();
});
