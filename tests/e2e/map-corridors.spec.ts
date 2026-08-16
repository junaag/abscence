import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://overpass-api.de/api/interpreter', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ elements: [] }) });
  });
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('absence-v020-map-state', JSON.stringify({
      center: { lat: 43.4053, lng: 5.0548 },
      zoom: 17,
      explored: [{ lat: 43.4053, lng: 5.0548, radiusM: 85 }],
      exploredCorridors: [{
        radiusM: 10,
        points: [
          { lat: 43.4053, lng: 5.0548 },
          { lat: 43.4053, lng: 5.0558 },
          { lat: 43.4054, lng: 5.0568 },
        ],
      }],
    }));
  });
  await page.reload();
});

test('fog restores compact geographic corridors from persisted map state', async ({ page }) => {
  await page.getByRole('button', { name: /Carte/ }).click();
  const fog = page.getByTestId('map-fog');
  await expect(fog).toBeVisible();
  await expect(fog).toHaveAttribute('data-explored-areas', '1');
  await expect(fog).toHaveAttribute('data-explored-corridors', '1');

  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('absence-v020-map-state') ?? '{}')) as { exploredCorridors?: unknown[] };
  expect(persisted.exploredCorridors).toHaveLength(1);
});

test('real exterior movement reveals persistent map corridors', async ({ page }) => {
  await page.evaluate(() => localStorage.removeItem('absence-v020-map-state'));
  await page.reload();

  await page.getByRole('button', { name: /Aller vers Cuisine/ }).click();
  await page.getByRole('button', { name: /Aller vers Jardin/ }).click();
  await page.getByRole('button', { name: /Ouvrir vers Rue devant la maison/ }).click();
  await page.getByRole('button', { name: /Aller vers Rue devant la maison/ }).click();

  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('absence-v020-map-state') ?? '{}')) as {
    explored?: unknown[];
    exploredCorridors?: unknown[];
  };
  expect(persisted.explored).toHaveLength(3);
  expect(persisted.exploredCorridors).toHaveLength(2);

  await page.getByRole('button', { name: /Carte/ }).click();
  const fog = page.getByTestId('map-fog');
  await expect(fog).toHaveAttribute('data-explored-areas', '3');
  await expect(fog).toHaveAttribute('data-explored-corridors', '2');
});
