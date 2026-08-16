import { expect, test } from '@playwright/test';

const NEW_SAVE_KEY = 'absence-v020-prologue-r2';

test('revised prologue intentionally ignores previous preview progression', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('absence-v020-dev', JSON.stringify({
      gameVersion: '0.2.0-dev',
      player: { locationId: 'kitchen', healthPv: 73 },
    }));
    localStorage.setItem('absence-preview-v0111', JSON.stringify({
      locationId: 'kitchen',
      stats: { health: 52 },
    }));
  });
  await page.reload();

  await expect(page.getByRole('heading', { name: 'Chambre' })).toBeVisible();
  await expect(page.getByTestId('home-view')).toContainText('flash');
  await expect(page.getByRole('button', { name: /Inventaire/ })).toBeVisible();
  await expect(page.locator('nav').getByRole('button', { name: /Téléphone/ })).toHaveCount(0);

  const current = await page.evaluate((key) => localStorage.getItem(key), NEW_SAVE_KEY);
  expect(current).toBeNull();
});

test('once the revised prologue creates its own save, that progression reloads normally', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole('button', { name: /Aller vers Cuisine/ }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Cuisine' })).toBeVisible();

  const current = await page.evaluate((key) => localStorage.getItem(key), NEW_SAVE_KEY);
  expect(current).not.toBeNull();
});
