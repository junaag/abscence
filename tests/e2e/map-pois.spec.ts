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

async function travelToPoi(page: Page, poiId: string): Promise<void> {
  await page.getByRole('button', { name: /Carte/ }).click();
  await expect(page.getByTestId('zone-alpha-map')).toBeVisible();
  await page.locator(`[data-poi-id="${poiId}"]`).click();
  await page.getByRole('button', { name: 'S’y rendre' }).click();
}

async function completeCurrentSearch(page: Page, firstLabel: RegExp, totalClicks: number): Promise<void> {
  await page.getByRole('button', { name: firstLabel }).click();
  for (let index = 1; index < totalClicks; index += 1) {
    await page.getByRole('button', { name: /Continuer la fouille de/ }).click();
  }
}

test('Zone Alpha is an offline XY overlay and map travel cannot bypass an interior', async ({ page }) => {
  await page.getByRole('button', { name: /Carte/ }).click();

  await expect(page.getByTestId('map-view')).toBeVisible();
  await expect(page.getByTestId('zone-alpha-map')).toBeVisible();
  await expect(page.getByTestId('map-fog')).toBeVisible();
  await expect(page.locator('[data-poi-id^="house_"]')).toHaveCount(7);
  await expect(page.locator('[data-poi-id="fuel_station"]')).toBeVisible();
  await expect(page.locator('[data-poi-id="pharmacy"]')).toBeVisible();
  await expect(page.locator('[data-poi-id="bakery"]')).toBeVisible();
  await expect(page.locator('[data-poi-id="grocery"]')).toBeVisible();
  await expect(page.locator('[data-poi-id="fire_station"]')).toBeVisible();

  await page.locator('[data-poi-id="fuel_station"]').click();
  await expect(page.locator('[data-zone-popup]')).toContainText('Station service');
  await expect(page.locator('[data-zone-popup]')).toContainText(/X 252 · Y 362/);
  await page.getByRole('button', { name: 'S’y rendre' }).click();

  await expect(page.getByTestId('map-view')).toBeVisible();
  await expect(page.locator('.map-result')).toContainText('Impossible depuis ici');
  await expect(page.locator('.map-result')).toContainText('rejoindre l’extérieur');
});

test('successful Zone Alpha travel closes the map overlay and returns to the narrative', async ({ page }) => {
  await reachStreet(page);
  await travelToPoi(page, 'fuel_station');

  await expect(page.getByTestId('map-view')).toHaveCount(0);
  await expect(page.getByTestId('home-view')).toBeVisible();
  await expect(page.locator('.place')).toHaveText('Station service');
  await expect(page.getByTestId('home-view')).toContainText('Station service');

  await travelToPoi(page, 'house_1');
  await expect(page.getByTestId('map-view')).toHaveCount(0);
  await expect(page.locator('.place')).toHaveText('Jardin');
});

test('a Zone Alpha station uses significant spaces, persistent long searches and hidden access discovery', async ({ page }) => {
  await reachStreet(page);
  await travelToPoi(page, 'fuel_station');
  await expect(page.locator('.place')).toHaveText('Station service');

  await expect(page.getByTestId('home-view')).toContainText('De l’extérieur');
  await page.getByRole('button', { name: 'Observer les lieux' }).click();
  await expect(page.getByText('Vous observez les lieux.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Entrer' }).click();

  await expect(page.getByTestId('home-view')).toContainText('boutique / accueil');
  await expect(page.getByTestId('home-view')).toContainText('Bouteille d’eau');
  await expect(page.getByRole('button', { name: /Sécuriser la zone/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Forcer l’accès vers réserve/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Explorer local technique/ })).toHaveCount(0);

  await page.getByRole('button', { name: /Sécuriser la zone/ }).click();
  await page.getByRole('button', { name: /Fouiller boutique \/ accueil méthodiquement/ }).click();
  await expect(page.getByText('Vous fouillez boutique / accueil méthodiquement.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Continuer la fouille de boutique \/ accueil/ })).toHaveText(/15\/45 min/);
  await expect(page.getByTestId('home-view')).not.toContainText('Lampe torche');

  await page.getByRole('button', { name: /Continuer la fouille de boutique \/ accueil/ }).click();
  await expect(page.getByRole('button', { name: /Continuer la fouille de boutique \/ accueil/ })).toHaveText(/30\/45 min/);
  await expect(page.getByTestId('home-view')).not.toContainText('Boîte de conserve');

  await page.getByRole('button', { name: /Continuer la fouille de boutique \/ accueil/ }).click();
  await expect(page.getByText('Vous terminez la fouille de boutique / accueil.', { exact: true })).toBeVisible();
  await expect(page.getByTestId('home-view')).toContainText('Lampe torche');
  await expect(page.getByTestId('home-view')).toContainText('Boîte de conserve');
  await expect(page.getByTestId('home-view')).toContainText('Indice :');
  await expect(page.getByRole('button', { name: /Explorer local technique/ })).toBeVisible();

  await page.getByRole('button', { name: /Forcer l’accès vers réserve/ }).click();
  await expect(page.getByTestId('home-view')).toContainText('réserve');
  await completeCurrentSearch(page, /Fouiller réserve méthodiquement/, 4);
  await expect(page.getByText('Vous terminez la fouille de réserve.', { exact: true })).toBeVisible();
  await expect(page.getByTestId('home-view')).toContainText('Caisse à outils');
  await expect(page.getByTestId('home-view')).toContainText('Pied-de-biche');

  await page.getByRole('button', { name: 'Sortir' }).click();
  await expect(page.getByTestId('home-view')).toContainText('devant Station service');
});
