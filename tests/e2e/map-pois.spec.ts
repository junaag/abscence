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

  const servicePaneZ = await page.locator('.leaflet-poi-pane').evaluate((element) => Number.parseInt(getComputedStyle(element).zIndex, 10));
  const fogPaneZ = await page.locator('.leaflet-fog-pane').evaluate((element) => Number.parseInt(getComputedStyle(element).zIndex, 10));
  expect(servicePaneZ).toBeGreaterThan(fogPaneZ);

  await page.locator('.leaflet-marker-icon[title="Station Ingres"]').click();
  const popup = page.locator('.leaflet-popup-content');
  await expect(popup).toContainText('Services');
  await expect(popup).toContainText('Station Ingres');
  await expect(popup).toContainText('Station service');
  await expect(popup.getByRole('button', { name: 'S’y rendre' })).toBeVisible();
});

test('a map POI becomes a real destination and the home marker becomes a real return trip', async ({ page }) => {
  await page.getByRole('button', { name: /Aller vers Cuisine/ }).click();
  await page.getByRole('button', { name: /Aller vers Jardin/ }).click();
  await page.getByRole('button', { name: /Ouvrir vers Rue devant la maison/ }).click();
  await page.getByRole('button', { name: /Aller vers Rue devant la maison/ }).click();

  await page.getByRole('button', { name: /Carte/ }).click();
  const fog = page.getByTestId('map-fog');
  await expect(page.locator('.leaflet-marker-icon[title="Station Ingres"]')).toBeVisible({ timeout: 6000 });
  await expect(fog).toHaveAttribute('data-explored-corridors', '2');

  await page.locator('.leaflet-marker-icon[title="Station Ingres"]').click();
  await page.locator('.leaflet-popup-content').getByRole('button', { name: 'S’y rendre' }).click();

  await expect(page.locator('.place')).toHaveText('Station Ingres');
  await expect(fog).toHaveAttribute('data-explored-corridors', '3');

  await page.locator('.absence-home-marker').click();
  await page.locator('.leaflet-popup-content').getByRole('button', { name: 'Revenir à la maison' }).click();

  await expect(page.locator('.place')).toHaveText('Jardin');
  await expect(fog).toHaveAttribute('data-explored-corridors', '4');
});
