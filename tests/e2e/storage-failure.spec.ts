import { expect, test } from '@playwright/test';

test('a browser storage write failure never blocks gameplay or rendering', async ({ page }) => {
  await page.addInitScript(() => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItemWithFailure(key: string, value: string): void {
      if (key.startsWith('absence-')) throw new DOMException('quota', 'QuotaExceededError');
      originalSetItem.call(this, key, value);
    };
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Chambre' })).toBeVisible();
  await expect(page.getByTestId('persistence-warning')).toHaveCount(0);

  await page.getByRole('button', { name: /Tiroir de la table de nuit/u }).click();
  await page.getByRole('button', { name: /Ouvrir/u }).click();

  await expect(page.getByText('Petite clé', { exact: true })).toBeVisible();
  await expect(page.getByTestId('persistence-warning')).toBeVisible();
  await expect(page.getByTestId('persistence-warning')).toContainText('Sauvegarde locale indisponible');
});
