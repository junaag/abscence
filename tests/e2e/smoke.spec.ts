import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('mobile shell loads without loader indirection', async ({ page }) => {
  await expect(page.getByTestId('hud')).toBeVisible();
  await expect(page.getByTestId('home-view')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Chambre' })).toBeVisible();
});

test('container opens in popup and reveals contents immediately', async ({ page }) => {
  await page.getByRole('button', { name: /Tiroir de la table de nuit/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: /Ouvrir/ }).click();
  await expect(page.getByText('Petite clé', { exact: true })).toBeVisible();
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

test('using the phone from its object popup opens the phone interface', async ({ page }) => {
  await page.getByRole('button', { name: /Inventaire/ }).click();
  await page.locator('[data-open-item="phone_01"]').click();
  await page.getByRole('button', { name: /^Utiliser/ }).click();
  await expect(page.getByTestId('phone-view')).toBeVisible();
});

test('phone restores local calls and messages with engine battery and network status', async ({ page }) => {
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

test('phone can attempt a real family call and persists the consequence', async ({ page }) => {
  await page.getByRole('button', { name: /Téléphone/ }).click();
  await page.getByRole('button', { name: 'Appels' }).click();
  await page.getByRole('button', { name: /^Appeler Épouse/ }).click();
  await expect(page.getByText('Aucune réponse de Épouse', { exact: true })).toBeVisible();
  await expect(page.getByText(/Aujourd’hui · 07:12/)).toBeVisible();
  await expect(page.getByTestId('phone-status')).not.toContainText('Batterie 78 %');
});

test('phone weather reads the persisted simulated world state', async ({ page }) => {
  await page.getByRole('button', { name: /Téléphone/ }).click();
  await page.getByRole('button', { name: 'Météo' }).click();
  await expect(page.getByTestId('phone-weather')).toBeVisible();
  await expect(page.getByText('23 °C')).toBeVisible();
  await expect(page.getByText('Ciel dégagé')).toBeVisible();
  await expect(page.getByText('55 %')).toBeVisible();
  await expect(page.getByText('8 km/h')).toBeVisible();
  await expect(page.getByText('0 mm/h')).toBeVisible();
  await expect(page.getByText('Monde simulé')).toBeVisible();
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

test('map mounts Leaflet with textured fog and preserves one map host across navigation', async ({ page }) => {
  await page.getByRole('button', { name: /Carte/ }).click();
  const map = page.getByTestId('leaflet-map');
  await expect(map).toBeVisible();
  await expect(page.getByTestId('map-fog')).toBeVisible();
  await expect(page.locator('.leaflet-container')).toHaveCount(1);
  await expect(page.locator('.absence-home-marker')).toBeVisible();
  await map.evaluate((element) => element.setAttribute('data-instance-token', 'persistent-map'));

  await page.locator('.absence-home-marker').click();
  await expect(page.getByRole('button', { name: 'Revenir à la maison' })).toBeVisible();
  await page.getByRole('button', { name: 'Revenir à la maison' }).click();
  await expect(page.getByTestId('home-view')).toBeVisible();

  await page.getByRole('button', { name: /Carte/ }).click();
  await expect(page.getByTestId('leaflet-map')).toHaveAttribute('data-instance-token', 'persistent-map');
  await expect(page.locator('.leaflet-container')).toHaveCount(1);
});
