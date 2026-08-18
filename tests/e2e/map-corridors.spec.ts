import { expect, test } from '@playwright/test';

const MAP_KEY = 'absence-v030-map-state-zone-alpha-r1';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate((mapKey) => {
    localStorage.clear();
    localStorage.setItem(mapKey, JSON.stringify({
      center: { x: 72, y: 344 },
      zoom: 1.35,
      explored: [{ x: 72, y: 344, radiusM: 18 }],
      exploredCorridors: [{
        radiusM: 7,
        points: [
          { x: 72, y: 344 },
          { x: 100, y: 340 },
          { x: 142, y: 336 },
        ],
      }],
    }));
  }, MAP_KEY);
  await page.reload();
});

test('fog restores compact XY corridors from persisted Zone Alpha map state', async ({ page }) => {
  await page.getByRole('button', { name: /Carte/ }).click();
  const fog = page.getByTestId('map-fog');
  await expect(fog).toBeVisible();
  await expect(fog).toHaveAttribute('data-explored-areas', '1');
  await expect(fog).toHaveAttribute('data-explored-corridors', '1');

  const persisted = await page.evaluate((mapKey) => JSON.parse(localStorage.getItem(mapKey) ?? '{}'), MAP_KEY) as { exploredCorridors?: unknown[] };
  expect(persisted.exploredCorridors).toHaveLength(1);
});

test('real exterior movement reveals narrow persistent local map corridors', async ({ page }) => {
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
  expect(persisted.explored?.at(-1)?.radiusM).toBe(16);
  expect(persisted.exploredCorridors).toHaveLength(2);
  expect(persisted.exploredCorridors?.at(-1)?.radiusM).toBe(7);

  await page.getByRole('button', { name: /Carte/ }).click();
  const fog = page.getByTestId('map-fog');
  await expect(fog).toHaveAttribute('data-explored-areas', '3');
  await expect(fog).toHaveAttribute('data-explored-corridors', '2');
});
