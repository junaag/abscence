import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

async function reachStreet(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Aller vers Cuisine/ }).click();
  await page.getByRole('button', { name: /Aller vers Jardin/ }).click();
  await page.getByRole('button', { name: /Ouvrir vers Rue devant le domicile/ }).click();
  await page.getByRole('button', { name: /Aller vers Rue devant le domicile/ }).click();
}

test('Marcher ici closes the Zone Alpha popup and map overlay after a successful outdoor step', async ({ page }) => {
  await reachStreet(page);
  await page.getByRole('button', { name: /Carte/ }).click();
  const map = page.getByTestId('zone-alpha-map');
  await expect(map).toBeVisible();

  const box = await map.boundingBox();
  if (!box) throw new Error('Zone Alpha map has no bounding box');
  const visibleX = Math.max(20, Math.min(box.width - 20, box.width * 0.3));
  const visibleY = Math.max(80, Math.min(box.height - 20, box.height * 0.2));
  await map.click({ position: { x: visibleX, y: visibleY } });

  const walkButton = page.getByRole('button', { name: 'Marcher ici' });
  await expect(walkButton).toBeVisible();
  await walkButton.click();

  await expect(page.locator('[data-zone-popup]')).toHaveCount(0);
  await expect(page.getByTestId('map-view')).toHaveCount(0);
  await expect(page.getByTestId('home-view')).toBeVisible();
  await expect(page.getByText('Vous avancez à pied.', { exact: true })).toBeVisible();
});
