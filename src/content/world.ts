import type { GameState } from '../engine/model';

export const INITIAL_STATE: GameState = {
  schemaVersion: 1,
  gameVersion: '0.2.0-dev',
  clock: { day: 1, secondOfDay: 7 * 3600 + 12 * 60 },
  engine: { damageBudgetPv: 0, elapsedSeconds: 0, nextEffectId: 1 },
  player: {
    locationId: 'bedroom',
    healthPv: 100,
    needs: { hunger: 12, thirst: 10, fatigue: 18, stress: 22, pain: 0 },
    inventoryIds: ['phone_01'],
    alive: true,
  },
  locations: {
    bedroom: { id: 'bedroom', name: 'Chambre', ambientTemperatureC: 20, ambientHumidityPercent: 50, ventilation: 0.15, features: {} },
    kitchen: { id: 'kitchen', name: 'Cuisine', ambientTemperatureC: 20, ambientHumidityPercent: 50, ventilation: 0.18, features: { tap: true, powerOutlet: true } },
    garden: { id: 'garden', name: 'Jardin', ambientTemperatureC: 20, ambientHumidityPercent: 50, ventilation: 1, features: {} },
  },
  connections: {
    bedroom_kitchen: { id: 'bedroom_kitchen', a: 'bedroom', b: 'kitchen', type: 'door', open: true, locked: false, openSeconds: 2, travelSeconds: 12 },
    kitchen_garden: { id: 'kitchen_garden', a: 'kitchen', b: 'garden', type: 'door', open: true, locked: false, openSeconds: 2, travelSeconds: 10 },
  },
  containers: {
    bedroom_drawer: { id: 'bedroom_drawer', definitionId: 'drawer', name: 'Tiroir de la table de nuit', locationId: 'bedroom', open: false, locked: false, contentIds: ['spare_key_01'] },
    kitchen_fridge: { id: 'kitchen_fridge', definitionId: 'refrigerator', name: 'Réfrigérateur', locationId: 'kitchen', open: false, locked: false, contentIds: [] },
  },
  items: {
    phone_01: { id: 'phone_01', definitionId: 'smartphone', name: 'Téléphone', location: { kind: 'inventory' }, examined: false, batteryPercent: 78, condition: 'Bon état' },
    apple_01: { id: 'apple_01', definitionId: 'apple', name: 'Pomme', location: { kind: 'location', id: 'kitchen' }, examined: false, freshnessPercent: 94 },
    water_01: { id: 'water_01', definitionId: 'water_bottle', name: "Bouteille d’eau", location: { kind: 'location', id: 'kitchen' }, examined: false, liquidMl: 500, capacityMl: 500, condition: 'Bon état' },
    towel_01: { id: 'towel_01', definitionId: 'towel', name: 'Torchon', location: { kind: 'location', id: 'kitchen' }, examined: false, condition: 'Sec' },
    spare_key_01: { id: 'spare_key_01', definitionId: 'key', name: 'Petite clé', location: { kind: 'container', id: 'bedroom_drawer' }, examined: false, condition: 'Bon état' },
  },
  infrastructure: {
    water: { available: true, pressure: 1 },
    electricity: { available: true, voltagePercent: 100 },
    mobile: { available: true, signal: 3 },
  },
  world: { effects: [], windowsOpen: { bedroom: false, kitchen: false }, leakActive: false },
  memory: { shoutedForWife: false, visitedLocationIds: ['bedroom'] },
};
