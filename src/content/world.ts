import { createInitialPhoneState } from './phone';
import type { GameState } from '../engine/model';
import { GAME_VERSION, SAVE_SCHEMA_VERSION } from '../version';

export const INITIAL_STATE: GameState = {
  schemaVersion: SAVE_SCHEMA_VERSION,
  gameVersion: GAME_VERSION,
  clock: { day: 1, secondOfDay: 7 * 3600 + 12 * 60 },
  engine: {
    damageBudgetPv: 0,
    elapsedSeconds: 0,
    nextEffectId: 1,
    infrastructureSeed: 1701,
    infrastructureSimulationEnabled: true,
    worldEventSeed: 1801,
    worldEventSimulationEnabled: true,
  },
  player: {
    locationId: 'bedroom',
    healthPv: 100,
    needs: { hunger: 12, thirst: 10, fatigue: 18, stress: 22, pain: 0 },
    inventoryIds: ['phone_01'],
    alive: true,
  },
  locations: {
    bedroom: { id: 'bedroom', name: 'Chambre', ambientTemperatureC: 20, ambientHumidityPercent: 50, ventilation: 0.15, features: {}, position: { x: 0, y: 0 } },
    kitchen: { id: 'kitchen', name: 'Cuisine', ambientTemperatureC: 20, ambientHumidityPercent: 50, ventilation: 0.18, features: { tap: true, powerOutlet: true }, position: { x: 10, y: 0 } },
    garden: { id: 'garden', name: 'Jardin', ambientTemperatureC: 20, ambientHumidityPercent: 50, ventilation: 1, features: {}, position: { x: 20, y: 0 } },
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
    phone_01: { id: 'phone_01', definitionId: 'smartphone', name: 'Téléphone', location: { kind: 'inventory' }, examined: false, condition: 'Bon état', batteryPercent: 78, enabled: false },
    flashlight_01: { id: 'flashlight_01', definitionId: 'flashlight', name: 'Lampe torche', location: { kind: 'location', id: 'bedroom' }, examined: false, condition: 'Bon état', batteryPercent: 64, enabled: false },
    spare_key_01: { id: 'spare_key_01', definitionId: 'key', name: 'Petite clé', location: { kind: 'container', id: 'bedroom_drawer' }, examined: false, condition: 'Bon état' },
    apple_01: { id: 'apple_01', definitionId: 'apple', name: 'Pomme', location: { kind: 'location', id: 'kitchen' }, examined: false, condition: 'Fraîche', freshnessPercent: 94 },
    water_01: { id: 'water_01', definitionId: 'water_bottle', name: 'Bouteille d’eau', location: { kind: 'location', id: 'kitchen' }, examined: false, condition: 'Bon état', liquidMl: 500, capacityMl: 500 },
    towel_01: { id: 'towel_01', definitionId: 'towel', name: 'Torchon', location: { kind: 'location', id: 'kitchen' }, examined: false, condition: 'Sec' },
  },
  infrastructure: {
    electricity: { phase: 'on', available: true, voltagePercent: 100 },
    water: { phase: 'on', available: true, pressurePercent: 100 },
    mobile: { phase: 'on', available: true, signalBars: 4, signalPercent: 100 },
    transitions: [],
  },
  world: {
    leakActive: false,
    windowOpenByLocation: { bedroom: false, kitchen: false, garden: true },
    effects: [],
  },
  phone: createInitialPhoneState(),
  memory: { shoutedForWife: false, visitedLocationIds: ['bedroom'] },
};
