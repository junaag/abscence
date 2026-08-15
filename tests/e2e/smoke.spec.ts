import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('mobile shell loads without loader indirection', async ({ page }) => {
  await expect(page.getByTestId('hud')).toBeVisible();
  await expect(page.getByTestId('home-view')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Chambre' })).toBeVisible();
});

test('container opens in popup and reveals contents immediately', async ({ page }) => {
  await page.getByRole('button', { name: /Tiroir de la table de nuit/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: /Ouvrir/ }).click();
  await expect(page.getByText('Petite clé', { exact: true })).toBeVisible();
});
