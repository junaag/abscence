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
