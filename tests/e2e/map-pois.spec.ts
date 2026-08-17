import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://overpass-api.de/api/interpreter', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        elements: [
          { type: 'node', id: 1, lat: 43.40546, lon: 5.0548, tags: { amenity: 'fuel', name: 'Station Ingres' } },
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

async function reachStreet(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: /Aller vers Cuisine/ }).click();
  await page.getByRole('button', { name: /Aller vers Jardin/ }).click();
  await page.getByRole('button', { name: /Ouvrir vers Rue devant le domicile/ }).click();
  await page.getByRole('button', { name: /Aller vers Rue devant le domicile/ }).click();
}

test('geographic POIs render above fog while travel still enforces the player location', async ({ page }) => {
  await page.getByRole('button', { name: /Carte/ }).click();
  await expect(page.getByTestId('map-fog')).toBeVisible();

  await expect(page.locator('.leaflet-marker-icon[title="Domicile"]')).toBeVisible({ timeout: 6000 });
  await expect(page.locator('.leaflet-marker-icon[title="Station Ingres"]')).toBeVisible();
  await expect(page.locator('.leaflet-marker-icon[title="Garage du Sud"]')).toBeVisible();
  await expect(page.locator('.leaflet-marker-icon[title="Police municipale"]')).toBeVisible();
  await expect(page.locator('.leaflet-marker-icon[title="Pharmacie du quartier"]')).toBeVisible();
  await expect(page.locator('[aria-label="Automobile — Station service"]')).toBeVisible();
  await expect(page.locator('[data-poi-category="Santé"]')).toBeVisible();

  const poiPaneZ = await page.locator('.leaflet-poi-pane').evaluate((element) => Number.parseInt(getComputedStyle(element).zIndex, 10));
  const fogPaneZ = await page.locator('.leaflet-fog-pane').evaluate((element) => Number.parseInt(getComputedStyle(element).zIndex, 10));
  expect(poiPaneZ).toBeGreaterThan(fogPaneZ);

  await page.locator('.leaflet-marker-icon[title="Station Ingres"]').click();
  const popup = page.locator('.leaflet-popup-content').filter({ hasText: 'Station Ingres' });
  await expect(popup).toContainText('Automobile');
  await expect(popup).toContainText('Station service');
  await popup.getByRole('button', { name: 'S’y rendre' }).click();

  await expect(page.locator('.map-result')).toContainText('Impossible depuis ici');
  await expect(page.locator('.map-result')).toContainText('rejoindre l’extérieur');
});

test('the domicile is a normal residential POI and POI travel becomes real once outside', async ({ page }) => {
  await reachStreet(page);

  await page.getByRole('button', { name: /Carte/ }).click();
  const fog = page.getByTestId('map-fog');
  await expect(page.locator('.leaflet-marker-icon[title="Station Ingres"]')).toBeVisible({ timeout: 6000 });
  await expect(fog).toHaveAttribute('data-explored-corridors', '2');

  await page.locator('.leaflet-marker-icon[title="Station Ingres"]').click();
  const stationPopup = page.locator('.leaflet-popup-content').filter({ hasText: 'Station Ingres' });
  await stationPopup.getByRole('button', { name: 'S’y rendre' }).click();
  await expect(page.locator('.place')).toHaveText('Station Ingres');
  await expect(fog).toHaveAttribute('data-explored-corridors', '3');

  await page.locator('.leaflet-marker-icon[title="Domicile"]').click();
  const homePopup = page.locator('.leaflet-popup-content').filter({ hasText: 'Domicile' });
  await expect(homePopup).toContainText('Résidentiel');
  await expect(homePopup).toContainText('Habitation');
  await homePopup.getByRole('button', { name: 'S’y rendre' }).click();

  await expect(page.locator('.place')).toHaveText('Jardin');
  await expect(fog).toHaveAttribute('data-explored-corridors', '4');
});

test('a station service exposes structured Automobile zones, risks and specific loot on mobile', async ({ page }) => {
  await reachStreet(page);
  await page.getByRole('button', { name: /Carte/ }).click();
  await expect(page.locator('.leaflet-marker-icon[title="Station Ingres"]')).toBeVisible({ timeout: 6000 });
  await page.locator('.leaflet-marker-icon[title="Station Ingres"]').click();
  await page.locator('.leaflet-popup-content').filter({ hasText: 'Station Ingres' }).getByRole('button', { name: 'S’y rendre' }).click();
  await expect(page.locator('.place')).toHaveText('Station Ingres');

  await page.locator('nav').getByRole('button', { name: /Accueil/ }).click();
  await expect(page.getByTestId('home-view')).toContainText('De l’extérieur');
  await page.getByRole('button', { name: 'Observer les lieux' }).click();
  await expect(page.getByText('Vous observez les lieux.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Entrer' }).click();

  await expect(page.getByTestId('home-view')).toContainText('boutique / accueil');
  await expect(page.getByTestId('home-view')).toContainText('Bouteille d’eau');
  await expect(page.getByRole('button', { name: /Sécuriser la zone/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Forcer l’accès vers réserve/ })).toBeVisible();

  await page.getByRole('button', { name: /Fouiller boutique \/ accueil méthodiquement/ }).click();
  await expect(page.getByText('Vous fouillez boutique / accueil méthodiquement.', { exact: true })).toBeVisible();
  await expect(page.getByTestId('home-view')).toContainText('Lampe torche');
  await expect(page.getByTestId('home-view')).toContainText('Boîte de conserve');
  await expect(page.getByTestId('home-view')).toContainText('Indice :');

  await page.getByTestId('home-view').getByText('Bouteille d’eau', { exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Prendre' }).click();
  await page.getByRole('button', { name: '×' }).click();

  await page.getByRole('button', { name: /Forcer l’accès vers réserve/ }).click();
  await expect(page.getByTestId('home-view')).toContainText('réserve');
  await page.getByRole('button', { name: /Fouiller réserve méthodiquement/ }).click();
  await expect(page.getByTestId('home-view')).toContainText('Caisse à outils');
  await expect(page.getByTestId('home-view')).toContainText('Pied-de-biche');

  await page.getByRole('button', { name: 'Sortir' }).click();
  await expect(page.getByTestId('home-view')).toContainText('devant Station Ingres');
});