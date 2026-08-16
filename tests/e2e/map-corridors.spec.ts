import { expect, test } from '@playwright/test';

const MAP_KEY = 'absence-v020-map-state-prologue-r2';

test.beforeEach(async ({ page }) => {
  await page.route('https://overpass-api.de/api/interpreter', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ elements: [] }) });
  });
  await page.goto('/');
  await page.evaluate((mapKey) => {
    localStorage.clear();
    localStorage.setItem(mapKey, JSON.stringify({
      center: { lat: 43.4053, lng: 5.0548 },
      zoom: 18,
      explored: [{ lat: 43.4053, lng: 5.0548, radiusM: 18 }],
      exploredCorridors: [{
        radiusM: 7,
        points: [
          { lat: 43.4053, lng: 5.0548 },
          { lat: 43.4053, lng: 5.0558 },
          { lat: 43.4054, lng: 5.0568 },
        ],
      }],
    }));
  }, MAP_KEY);
  await page.reload();
});

test('fog restores compact geographic corridors from persisted map state', async ({ page }) => {
  await page.getByRole('button', { name: /Carte/ }).click();
  const fog = page.getByTestId('map-fog');
  await expect(fog).toBeVisible();
  await expect(fog).toHaveAttribute('data-explored-areas', '1');
  await expect(fog).toHaveAttribute('data-explored-corridors', '1');

  const persisted = await page.evaluate((mapKey) => JSON.parse(localStorage.getItem(mapKey) ?? '{}'), MAP_KEY) as { exploredCorridors?: unknown[] };
  expect(persisted.exploredCorridors).toHaveLength(1);
});

test('real exterior movement reveals narrow persistent map corridors', async ({ page }) => {
  await page.evaluate((mapKey) => localStorage.removeItem(mapKey), MAP_KEY);
  await page.reload();

  await page.getByRole('button', { name: /Aller vers Cuisine/ }).click();
  await page.getByRole('button', { name: /Aller vers Jardin/ }).click();
  await page.getByRole('button', { name: /Ouvrir vers Rue devant le domicile/ }).click();
  await page.getByRole('button', { name: /Aller vers Rue devant le domicile/ }).click();

  const persisted = await page.evaluate((mapKey) => JSON.parse(localStorage.getItem(mapKey) ?? '{}'), MAP_KEY) as {
    explored?: Array<{ radiusM?: number }>;
    exploredCorridors?: Array<{ radiusM?: number }>;
  };
  expect(persisted.explored).toHaveLength(3);
  expect(persisted.explored.at(-1)?.radiusM).toBe(16);
  expect(persisted.exploredCorridors).toHaveLength(2);
  expect(persisted.exploredCorridors.at(-1)?.radiusM).toBe(7);

  await page.getByRole('button', { name: /Carte/ }).click();
  const fog = page.getByTestId('map-fog');
  await expect(fog).toHaveAttribute('data-explored-areas', '3');
  await expect(fog).toHaveAttribute('data-explored-corridors', '2');
});
