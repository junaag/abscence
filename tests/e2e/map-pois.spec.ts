import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://overpass-api.de/api/interpreter', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        elements: [
          { type: 'node', id: 1, lat: 43.40536, lon: 5.05485, tags: { amenity: 'fuel', name: 'Station Ingres' } },
          { type: 'node', id: 2, lat: 43.4057, lon: 5.0551, tags: { shop: 'car_repair', name: 'Garage du Sud' } },
          { type: 'node', id: 3, lat: 43.4059, lon: 5.0552, tags: { amenity: 'police', name: 'Police municipale' } },
          { type: 'node', id: 4, lat: 43.4061, lon: 5.0554, tags: { amenity: 'pharmacy', name: 'Pharmacie du quartier' } },
        ],
      }),
    });
  });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('only discovered POIs render and a failed travel explains why instead of looking inactive', async ({ page }) => {
  await page.getByRole('button', { name: /Carte/ }).click();
  await expect(page.getByTestId('map-fog')).toBeVisible();

  await expect(page.locator('.leaflet-marker-icon[title="Domicile"]')).toBeVisible({ timeout: 6000 });
  await expect(page.locator('.leaflet-marker-icon[title="Station Ingres"]')).toBeVisible();
  await expect(page.locator('.leaflet-marker-icon[title="Pharmacie du quartier"]')).toHaveCount(0);
  await expect(page.locator('[data-poi-category="Santé"]')).toHaveCount(0);

  const poiPaneZ = await page.locator('.leaflet-poi-pane').evaluate((element) => Number.parseInt(getComputedStyle(element).zIndex, 10));
  const fogPaneZ = await page.locator('.leaflet-fog-pane').evaluate((element) => Number.parseInt(getComputedStyle(element).zIndex, 10));
  expect(poiPaneZ).toBeGreaterThan(fogPaneZ);

  await page.locator('.leaflet-marker-icon[title="Station Ingres"]').click();
  const popup = page.locator('.leaflet-popup-content');
  await expect(popup).toContainText('Automobile');
  await expect(popup).toContainText('⛽');
  await popup.getByRole('button', { name: 'S’y rendre' }).click();

  await expect(page.locator('.map-result')).toContainText('Impossible depuis ici');
  await expect(page.locator('.map-result')).toContainText('rejoindre l’extérieur');
});

test('the domicile is a normal residential POI and POI travel becomes real once outside', async ({ page }) => {
  await page.getByRole('button', { name: /Aller vers Cuisine/ }).click();
  await page.getByRole('button', { name: /Aller vers Jardin/ }).click();
  await page.getByRole('button', { name: /Ouvrir vers Rue devant le domicile/ }).click();
  await page.getByRole('button', { name: /Aller vers Rue devant le domicile/ }).click();

  await page.getByRole('button', { name: /Carte/ }).click();
  const fog = page.getByTestId('map-fog');
  await expect(page.locator('.leaflet-marker-icon[title="Station Ingres"]')).toBeVisible({ timeout: 6000 });
  await expect(fog).toHaveAttribute('data-explored-corridors', '2');

  await page.locator('.leaflet-marker-icon[title="Station Ingres"]').click();
  await page.locator('.leaflet-popup-content').getByRole('button', { name: 'S’y rendre' }).click();
  await expect(page.locator('.place')).toHaveText('Station Ingres');
  await expect(fog).toHaveAttribute('data-explored-corridors', '3');

  await page.locator('.leaflet-marker-icon[title="Domicile"]').click();
  const homePopup = page.locator('.leaflet-popup-content');
  await expect(homePopup).toContainText('Résidentiel');
  await expect(homePopup).toContainText('Habitation');
  await homePopup.getByRole('button', { name: 'S’y rendre' }).click();

  await expect(page.locator('.place')).toHaveText('Jardin');
  await expect(fog).toHaveAttribute('data-explored-corridors', '4');
});
