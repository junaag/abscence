import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://overpass-api.de/api/interpreter', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        elements: [
          { type: 'node', id: 1, lat: 43.4055, lon: 5.0549, tags: { amenity: 'fuel', name: 'Station Ingres' } },
          { type: 'node', id: 2, lat: 43.4057, lon: 5.0551, tags: { shop: 'car_repair', name: 'Garage du Sud' } },
          { type: 'node', id: 3, lat: 43.4059, lon: 5.0552, tags: { amenity: 'police', name: 'Police municipale' } },
        ],
      }),
    });
  });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('nearby OSM POIs load after the map and remain above the fog layer', async ({ page }) => {
  await page.getByRole('button', { name: /Carte/ }).click();
  await expect(page.getByTestId('map-fog')).toBeVisible();

  await expect(page.locator('[data-poi-category="Services"]')).toHaveCount(2, { timeout: 6000 });
  await expect(page.locator('[data-poi-category="Services publics"]')).toHaveCount(1);

  const servicePaneZ = await page.locator('.leaflet-poiPane-pane').evaluate((element) => Number.parseInt(getComputedStyle(element).zIndex, 10));
  const fogPaneZ = await page.locator('.leaflet-fogPane-pane').evaluate((element) => Number.parseInt(getComputedStyle(element).zIndex, 10));
  expect(servicePaneZ).toBeGreaterThan(fogPaneZ);

  await page.locator('.leaflet-marker-icon[title="Station Ingres"]').click();
  const popup = page.locator('.leaflet-popup-content');
  await expect(popup).toContainText('Services');
  await expect(popup).toContainText('Station Ingres');
  await expect(popup).toContainText('Station service');
});
