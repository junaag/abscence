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
    garden: { id: 'garden', name: 'Jardin', ambientTemperatureC: 20, ambientHumidityPercent: 50, ventilation: 1, features: {}, position: { lat: 43.40528, lon: 5.05495 } },
    street: { id: 'street', name: 'Rue devant la maison', ambientTemperatureC: 20, ambientHumidityPercent: 50, ventilation: 1, features: {}, position: { lat: 43.40512, lon: 5.05464 } },
  },
  connections: {
    bedroom_kitchen: { id: 'bedroom_kitchen', a: 'bedroom', b: 'kitchen', type: 'door', open: true, locked: false, openSeconds: 2, travelSeconds: 12 },
    kitchen_garden: { id: 'kitchen_garden', a: 'kitchen', b: 'garden', type: 'door', open: true, locked: false, openSeconds: 2, travelSeconds: 10 },
    garden_street: { id: 'garden_street', a: 'garden', b: 'street', type: 'door', open: false, locked: false, openSeconds: 5, travelSeconds: 45 },
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
    outlet_01: { id: 'outlet_01', definitionId: 'wall_outlet', name: 'Prise électrique', location: { kind: 'location', id: 'kitchen' }, examined: false },
    spare_key_01: { id: 'spare_key_01', definitionId: 'key', name: 'Petite clé', location: { kind: 'container', id: 'bedroom_drawer' }, examined: false, condition: 'Bon état' },
  },
  infrastructure: {
    water: { available: true, pressure: 1 },
    electricity: { available: true, voltagePercent: 100 },
    mobile: { available: true, signal: 4, signalPercent: 100 },
    transitions: [],
  },
  world: {
    effects: [],
    windowsOpen: { bedroom: false, kitchen: false },
    leakActive: false,
    scheduledEvents: [
      { id: 'evt_noise', atSeconds: 5 * 60, type: 'noise_source', locationId: 'kitchen', processed: false },
      { id: 'evt_leak', atSeconds: 12 * 60, type: 'water_leak', locationId: 'kitchen', processed: false },
      { id: 'evt_smoke', atSeconds: 25 * 60, type: 'smoke', locationId: 'garden', processed: false },
    ],
    eventHistory: [],
    eventSources: {},
    events: [],
  },
  phone: createInitialPhoneState(),
  memory: { shoutedForWife: false, visitedLocationIds: ['bedroom'] },
};
