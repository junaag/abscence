import { expect, test } from '@playwright/test';

const legacyState = {
  time: { h: 8, m: 5, s: 0 },
  gameDate: { year: 2026, month: 8, day: 9 },
  locationId: 'kitchen',
  stats: { health: 73, hunger: 31, thirst: 42, fatigue: 27, stress: 35, pain: 4 },
  inventory: ['phone_01', 'water_bottle_01'],
  items: {
    phone_01: { id: 'phone_01', definitionId: 'smartphone', locationId: 'inventory', state: { batteryPct: 61 } },
    water_bottle_01: { id: 'water_bottle_01', definitionId: 'water_bottle_500', locationId: 'inventory', state: { liquidMl: 125, capacityMl: 500 } },
  },
  world: { powerAvailable: true, waterNetworkAvailable: true, effects: [] },
};

test('browser startup atomically promotes a valid v0.1.11 save to v0.2', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((state) => {
    localStorage.clear();
    localStorage.setItem('absence-preview-v0111', JSON.stringify(state));
  }, legacyState);
  await page.reload();

  await expect(page.getByRole('heading', { name: 'Cuisine' })).toBeVisible();

  const persisted = await page.evaluate(() => {
    const current = localStorage.getItem('absence-v020-dev');
    const legacy = localStorage.getItem('absence-preview-v0111');
    return { current: current ? JSON.parse(current) : null, legacyPresent: legacy !== null };
  });

  expect(persisted.current?.gameVersion).toBe('0.2.0-dev');
  expect(persisted.current?.player?.healthPv).toBe(73);
  expect(persisted.current?.player?.locationId).toBe('kitchen');
  expect(persisted.current?.items?.water_01?.liquidMl).toBe(125);
  expect(persisted.legacyPresent).toBe(true);
});

test('browser startup never promotes corrupt legacy data', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('absence-preview-v0111', '{broken');
  });
  await page.reload();

  await expect(page.getByRole('heading', { name: 'Chambre' })).toBeVisible();
  const current = await page.evaluate(() => localStorage.getItem('absence-v020-dev'));
  expect(current).toBeNull();
});
