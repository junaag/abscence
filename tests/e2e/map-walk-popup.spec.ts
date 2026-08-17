import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://overpass-api.de/api/interpreter', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ elements: [] }) });
  });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('Marcher ici closes its map popup immediately after the click', async ({ page }) => {
  await page.getByRole('button', { name: /Carte/ }).click();
  const map = page.getByTestId('leaflet-map');
  await expect(map).toBeVisible();

  const box = await map.boundingBox();
  if (!box) throw new Error('Map has no bounding box');
  await map.click({ position: { x: Math.max(30, Math.floor(box.width * 0.25)), y: Math.max(100, Math.floor(box.height * 0.65)) } });

  const walkButton = page.getByRole('button', { name: 'Marcher ici' });
  await expect(walkButton).toBeVisible();
  await walkButton.click();
  await expect(page.locator('.walk-popup')).toHaveCount(0);
});
