import { readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { runInNewContext } from 'node:vm';
import { expect, test } from '@playwright/test';

interface HistoricalEngine {
  VERSION: string;
  createInitialState(): Record<string, unknown>;
}

type UnknownRecord = Record<string, unknown>;

function object(value: unknown): UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected historical object');
  return value as UnknownRecord;
}

function partNumber(name: string): number {
  return Number(name.match(/(\d+)/)?.[1] ?? Number.MAX_SAFE_INTEGER);
}

function loadHistoricalEngine(): HistoricalEngine {
  const directory = 'v0111/engine-b64';
  const encoded = readdirSync(directory)
    .filter((name) => name.endsWith('.txt'))
    .sort((a, b) => partNumber(a) - partNumber(b))
    .map((name) => readFileSync(`${directory}/${name}`, 'utf8').trim())
    .join('');
  const source = gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8');
  const moduleRef: { exports: unknown } = { exports: {} };
  runInNewContext(source, { module: moduleRef }, { timeout: 1000 });
  return moduleRef.exports as HistoricalEngine;
}

function historicalStats(state: UnknownRecord): UnknownRecord {
  if (state.stats && typeof state.stats === 'object') return object(state.stats);
  const player = object(state.player);
  return object(player.stats ?? player.needs);
}

function historicalInventory(state: UnknownRecord): unknown[] {
  if (Array.isArray(state.inventory)) return state.inventory;
  const player = object(state.player);
  if (Array.isArray(player.inventoryIds)) return player.inventoryIds;
  if (Array.isArray(player.inventory)) return player.inventory;
  throw new Error('Historical inventory not found');
}

function historicalBottle(state: UnknownRecord): [string, UnknownRecord] {
  const items = object(state.items);
  for (const [id, raw] of Object.entries(items)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const item = raw as UnknownRecord;
    if (id === 'water_bottle_01' || String(item.definitionId ?? '').startsWith('water_bottle')) return [id, item];
  }
  throw new Error('Historical water bottle not found');
}

function mutableItemState(item: UnknownRecord): UnknownRecord {
  return item.state && typeof item.state === 'object' && !Array.isArray(item.state) ? object(item.state) : item;
}

const historicalEngine = loadHistoricalEngine();

test('browser startup atomically promotes a genuine v0.1.11 save to v0.2', async ({ page }) => {
  expect(historicalEngine.VERSION).toBe('0.1.11');
  const legacyState = historicalEngine.createInitialState();
  legacyState.locationId = 'kitchen';
  const stats = historicalStats(legacyState);
  stats.health = 73;
  stats.hunger = 31;
  stats.thirst = 42;
  stats.fatigue = 27;
  stats.stress = 35;
  stats.pain = 4;

  const [waterId, bottle] = historicalBottle(legacyState);
  const bottleState = mutableItemState(bottle);
  if ('liquidMl' in bottleState) bottleState.liquidMl = 125;
  else if ('amountMl' in bottleState) bottleState.amountMl = 125;
  else if ('waterMl' in bottleState) bottleState.waterMl = 125;
  else bottleState.liquidMl = 125;
  const inventory = historicalInventory(legacyState);
  if (!inventory.includes(waterId)) inventory.push(waterId);

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
  expect(persisted.current?.items?.water_01?.location?.kind).toBe('inventory');
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
