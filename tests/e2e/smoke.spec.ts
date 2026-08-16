import { expect, test, type Page } from '@playwright/test';

async function takePhone(page: Page): Promise<void> {
  await page.getByTestId('home-view').getByRole('button', { name: /Téléphone/u }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Prendre' }).click();
  await page.getByRole('button', { name: '×' }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('mobile shell starts from the amnesiac bedroom without carried equipment', async ({ page }) => {
  await expect(page.getByTestId('hud')).toBeVisible();
  await expect(page.getByTestId('home-view')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Chambre' })).toBeVisible();
  await expect(page.getByTestId('home-view')).toContainText('flash');
  await expect(page.locator('.clock')).toHaveText('Début de matinée');
  await expect(page.locator('nav').getByRole('button', { name: /Téléphone/ })).toHaveCount(0);

  await page.getByRole('button', { name: /Inventaire/ }).click();
  await expect(page.getByText('Vous ne transportez encore rien.')).toBeVisible();
  await expect(page.getByTestId('carry-capacity')).toContainText('0 / 4');
});

test('container opens in popup and reveals watch and key immediately', async ({ page }) => {
  await page.getByRole('button', { name: /Tiroir de la table de nuit/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: /Ouvrir/ }).click();
  await expect(page.getByText('Petite clé', { exact: true })).toBeVisible();
  await expect(page.getByText('Montre', { exact: true })).toBeVisible();
});

test('taking the watch reveals exact time without requiring a phone', async ({ page }) => {
  await page.getByRole('button', { name: /Tiroir de la table de nuit/ }).click();
  await page.getByRole('button', { name: /Ouvrir/ }).click();
  await page.getByText('Montre', { exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Prendre' }).click();
  await expect(page.locator('.clock')).toHaveText(/07:12/);
  await expect(page.locator('nav').getByRole('button', { name: /Téléphone/ })).toHaveCount(0);
});

test('closing a container popup naturally closes the container', async ({ page }) => {
  await page.getByRole('button', { name: /Aller vers Cuisine/ }).click();
  await page.getByRole('button', { name: /Réfrigérateur/ }).click();
  await page.getByRole('button', { name: /^Ouvrir/ }).click();
  await expect(page.getByRole('dialog')).toContainText('Ouvert');
  await page.getByRole('button', { name: '×' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Réfrigérateur.*Fermé/ })).toBeVisible();
});

test('an obvious food can be eaten directly from its contextual popup', async ({ page }) => {
  await page.getByRole('button', { name: /Aller vers Cuisine/ }).click();
  await page.locator('[data-open-item="apple_01"]').click();
  await expect(page.getByRole('button', { name: /^Manger/ })).toBeVisible();
  await page.getByRole('button', { name: /^Manger/ }).click();
  await expect(page.getByText('Vous mangez la pomme.', { exact: true })).toBeVisible();
  await expect(page.locator('[data-open-item="apple_01"]')).toHaveCount(0);
});

test('backpack is found in the world and increases carry capacity only when equipped', async ({ page }) => {
  await page.getByRole('button', { name: /Aller vers Cuisine/ }).click();
  await page.locator('[data-open-item="backpack_01"]').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Prendre' }).click();
  await page.getByRole('button', { name: '×' }).click();
  await page.getByRole('button', { name: /Inventaire/ }).click();
  await expect(page.getByTestId('carry-capacity')).toContainText('/ 4');
  await page.locator('[data-open-item="backpack_01"]').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Équiper' }).click();
  await expect(page.getByTestId('carry-capacity')).toContainText('/ 12');
});

test('using a found phone opens the phone interface and adds its navigation entry', async ({ page }) => {
  await takePhone(page);
  await expect(page.locator('nav').getByRole('button', { name: /Téléphone/ })).toBeVisible();
  await page.getByRole('button', { name: /Inventaire/ }).click();
  await page.locator('[data-open-item="phone_01"]').click();
  await page.getByRole('dialog').getByRole('button', { name: /^Utiliser/ }).click();
  await expect(page.getByTestId('phone-view')).toBeVisible();
});

test('found phone restores local calls and messages with engine battery and network status', async ({ page }) => {
  await takePhone(page);
  await page.getByRole('button', { name: /Téléphone/ }).click();
  await expect(page.getByTestId('phone-view')).toBeVisible();
  await expect(page.getByTestId('phone-status')).toContainText('Batterie 78 %');
  await expect(page.getByTestId('phone-status')).toContainText('Réseau 4/4');

  await page.getByRole('button', { name: 'Messages' }).click();
  await expect(page.getByText('« Tu peux penser au pain ? » · hier 19:03')).toBeVisible();
  await expect(page.getByText('« ok papa » · hier 17:48')).toBeVisible();
  await expect(page.getByText('Photo · hier 17:31')).toBeVisible();

  await page.getByRole('button', { name: '‹ Accueil', exact: true }).click();
  await page.getByRole('button', { name: 'Appels' }).click();
  await expect(page.getByText('Dernier appel hier · 22:41')).toBeVisible();
  await expect(page.getByText('Hier · 18:12')).toBeVisible();
  await expect(page.getByText('Hier · 18:09')).toBeVisible();
});

test('phone can attempt a real family call after being discovered', async ({ page }) => {
  await takePhone(page);
  await page.getByRole('button', { name: /Téléphone/ }).click();
  await page.getByRole('button', { name: 'Appels' }).click();
  await page.getByRole('button', { name: /^Appeler Épouse/ }).click();
  await expect(page.getByText('Aucune réponse de Épouse', { exact: true })).toBeVisible();
  await expect(page.getByText(/Aujourd’hui · 07:12/)).toBeVisible();
  await expect(page.getByTestId('phone-status')).not.toContainText('Batterie 78 %');
});

test('phone weather reads the persisted simulated world state', async ({ page }) => {
  await takePhone(page);
  await page.getByRole('button', { name: /Téléphone/ }).click();
  await page.getByRole('button', { name: 'Météo' }).click();
  await expect(page.getByTestId('phone-weather')).toBeVisible();
  await expect(page.getByText('23 °C')).toBeVisible();
  await expect(page.getByText('Ciel dégagé')).toBeVisible();
  await expect(page.getByText('55 %')).toBeVisible();
  await expect(page.getByText('8 km/h')).toBeVisible();
  await expect(page.getByText('0 mm/h')).toBeVisible();
  await expect(page.getByText('Appareil')).toBeVisible();
});

test('hamburger menu exposes home settings about and persists sound preference', async ({ page }) => {
  await page.getByRole('button', { name: 'Menu' }).click();
  let menu = page.getByTestId('menu-sheet');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('button', { name: /^Accueil/ })).toBeVisible();
  await expect(menu.getByRole('button', { name: /^Paramètres/ })).toBeVisible();
  await expect(menu.getByRole('button', { name: /^À propos/ })).toBeVisible();

  await menu.getByRole('button', { name: /^Paramètres/ }).click();
  await expect(page.getByTestId('sound-setting')).toHaveText('Activé');
  await page.getByRole('switch').click();
  await expect(page.getByTestId('sound-setting')).toHaveText('Coupé');

  await page.reload();
  await page.getByRole('button', { name: 'Menu' }).click();
  menu = page.getByTestId('menu-sheet');
  await menu.getByRole('button', { name: /^Paramètres/ }).click();
  await expect(page.getByTestId('sound-setting')).toHaveText('Coupé');

  await page.getByRole('button', { name: '‹ Menu' }).click();
  menu = page.getByTestId('menu-sheet');
  await menu.getByRole('button', { name: /^À propos/ }).click();
  await expect(page.getByText('ABSENCE · v0.2.0-dev')).toBeVisible();
  await expect(page.getByText('Création : Julien Imbert.')).toBeVisible();
});

test('map mounts once and domicile uses the same residential POI treatment', async ({ page }) => {
  await page.route('https://overpass-api.de/api/interpreter', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ elements: [] }) });
  });
  await page.getByRole('button', { name: /Carte/ }).click();
  const map = page.getByTestId('leaflet-map');
  await expect(map).toBeVisible();
  await expect(page.getByTestId('map-fog')).toBeVisible();
  await expect(page.locator('.leaflet-container')).toHaveCount(1);
  await expect(page.locator('.leaflet-marker-icon[title="Domicile"]')).toBeVisible();
  await expect(page.locator('[aria-label="Résidentiel — Habitation"]')).toBeVisible();
  await map.evaluate((element) => element.setAttribute('data-instance-token', 'persistent-map'));

  await page.locator('.leaflet-marker-icon[title="Domicile"]').click();
  await expect(page.getByRole('button', { name: 'S’y rendre' })).toBeVisible();
  await page.locator('nav').getByRole('button', { name: /Accueil/ }).click();
  await expect(page.getByTestId('home-view')).toBeVisible();

  await page.getByRole('button', { name: /Carte/ }).click();
  await expect(page.getByTestId('leaflet-map')).toHaveAttribute('data-instance-token', 'persistent-map');
  await expect(page.locator('.leaflet-container')).toHaveCount(1);
});
