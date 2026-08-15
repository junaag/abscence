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
