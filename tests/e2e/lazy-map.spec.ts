import { expect, test } from '@playwright/test';

test('map JavaScript stays off the startup path until the player opens Carte', async ({ page }) => {
  const mapChunkRequests: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (/\/assets\/map-[^/]+\.js(?:\?|$)/u.test(url)) mapChunkRequests.push(url);
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Chambre' })).toBeVisible();
  await page.waitForTimeout(150);

  expect(mapChunkRequests).toEqual([]);

  await page.getByRole('button', { name: /Carte/u }).click();
  await expect(page.getByTestId('leaflet-map')).toBeVisible();
  await expect.poll(() => mapChunkRequests.length).toBeGreaterThan(0);

  const uniqueMapChunks = new Set(mapChunkRequests.map((url) => new URL(url).pathname));
  expect(uniqueMapChunks.size).toBe(1);

  await page.getByRole('button', { name: /Accueil/u }).click();
  await page.getByRole('button', { name: /Carte/u }).click();
  await expect(page.getByTestId('leaflet-map')).toBeVisible();
  await page.waitForTimeout(100);

  expect(new Set(mapChunkRequests.map((url) => new URL(url).pathname)).size).toBe(1);
});
