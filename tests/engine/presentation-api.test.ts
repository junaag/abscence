import { describe, expect, it } from 'vitest';
import * as presentationApi from '../../src/app/game-api';

const EXPECTED_RUNTIME_EXPORTS = [
  'containerContents',
  'containersAtCurrentLocation',
  'currentLocation',
  'describeItemExamination',
  'formatClock',
  'getContainerActions',
  'getContextActions',
  'getItemActions',
  'getMobileNetworkState',
  'getWeatherState',
  'inventoryItems',
  'looseItemsAtCurrentLocation',
  'performAction',
  'phoneCalls',
  'phoneDeviceItemId',
  'phoneMessages',
] as const;

const FORBIDDEN_SIMULATION_EXPORTS = [
  'addPersistentEffect',
  'advanceTime',
  'applyInfrastructureTransition',
  'createInitialState',
  'loadState',
  'migrateLegacyPreviewState',
  'processPersistentEffects',
  'saveState',
  'scheduleWorldEventSource',
  'validateState',
] as const;

describe('presentation-safe game API contract', () => {
  it('exports only the deliberately approved runtime surface', () => {
    expect(Object.keys(presentationApi).sort()).toEqual([...EXPECTED_RUNTIME_EXPORTS].sort());
  });

  it.each(EXPECTED_RUNTIME_EXPORTS)('exports %s as a callable presentation capability', (name) => {
    expect(presentationApi[name]).toBeTypeOf('function');
  });

  it.each(FORBIDDEN_SIMULATION_EXPORTS)('never exposes simulation/admin helper %s to UI code', (name) => {
    expect(name in presentationApi).toBe(false);
  });
});
