import { describe, expect, it } from 'vitest';
import * as engine from '../../src/engine';

const REQUIRED_FUNCTIONS = [
  'performAction',
  'getContextActions',
  'getContainerActions',
  'getItemActions',
  'createInitialState',
  'loadState',
  'saveState',
  'migrateLegacyPreviewState',
  'loadLegacyPreviewMigration',
  'validateState',
  'isElectricityAvailable',
  'isWaterAvailable',
  'isMobileAvailable',
  'getPhoneCapabilities',
  'getPlayerEnvironment',
  'getDistanceMeters',
  'getWorldEventPerception',
  'getPerceivedWorldEvents',
  'getWeatherState',
] as const;

describe('public engine facade contract', () => {
  it.each(REQUIRED_FUNCTIONS)('exports %s as a callable public API', (name) => {
    expect(engine[name]).toBeTypeOf('function');
  });

  it('exports the persistence keys needed by the application boundary', () => {
    expect(engine.SAVE_KEY).toBe('absence-v020-dev');
    expect(engine.LEGACY_PREVIEW_SAVE_KEYS).toEqual(['absence-preview-v0111', 'absence-preview-v019']);
  });
});
