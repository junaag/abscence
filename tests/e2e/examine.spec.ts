import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('Examiner enriches the object popup without being required to use the object', async ({ page }) => {
  await page.getByRole('button', { name: /Inventaire/u }).click();
  await page.getByRole('button', { name: /Téléphone/u }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Utiliser' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Examiner' })).toBeVisible();
  await expect(page.getByTestId('item-examination')).toContainText('Touchez « Examiner »');

  await dialog.getByRole('button', { name: 'Examiner' }).click();

  await expect(dialog).toBeVisible();
  await expect(page.getByTestId('item-examination')).toContainText('téléphone personnel');
  await expect(page.getByTestId('item-examination')).toContainText('fonctionne sur batterie');
  await expect(page.getByTestId('item-examination')).toContainText('Batterie : 78.0 %');
  await expect(dialog.getByRole('button', { name: 'Utiliser' })).toBeVisible();
});
