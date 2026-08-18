import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('touching an object shows its examination directly without a duplicate Examiner button', async ({ page }) => {
  await page.getByTestId('home-view').getByRole('button', { name: /Téléphone/u }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Examiner' })).toHaveCount(0);
  await expect(page.getByTestId('item-examination')).toContainText('smartphone');
  await expect(page.getByTestId('item-examination')).toContainText('fonctionne sur batterie');
  await expect(page.getByTestId('item-examination')).toContainText('Batterie : 78.0 %');
  await expect(dialog.getByRole('button', { name: 'Prendre' })).toBeVisible();
});
