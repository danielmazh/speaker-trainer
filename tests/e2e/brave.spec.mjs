// Brave on Android ships SpeechRecognition but blocks its service. The app must say so and still work.
import { test, expect } from './fixtures.mjs';

test('Brave: honest note, no "you chose", record or type still works', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, 'brave', { value: { isBrave: () => Promise.resolve(true) }, configurable: true }); });
  await page.goto('./#home');
  await page.evaluate(() => { localStorage.setItem('speakerTrainer.v1', JSON.stringify({ v: 1, onboarded: true, name: 'Alex' })); });
  await page.goto('./#mission');
  await page.reload();
  await page.getByRole('button', { name: /התחל|מתחילים|המשך/ }).first().click();
  await expect(page.getByText(/Brave חוסם זיהוי דיבור/).first()).toBeVisible();
  await expect(page.getByText(/בחרת/)).toHaveCount(0);
  await expect(page.getByTestId('mic-type')).toBeVisible();
});
