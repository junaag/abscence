import { describe, expect, it } from 'vitest';
import { normalizePersistedGameState } from '../../src/engine/save-normalization';
import { createInitialState } from '../../src/engine/state';
import { GAME_VERSION, SAVE_SCHEMA_VERSION } from '../../src/version';

describe('persisted save normalization boundary', () => {
  it('normalizes a compatible save without mutating the parsed input object', () => {
    const input = createInitialState();
    input.gameVersion = '0.2.0-dev-older-label';
    input.player.healthPv = 74;
    const before = structuredClone(input);

    const normalized = normalizePersistedGameState(input);

    expect(input).toEqual(before);
    expect(normalized?.player.healthPv).toBe(74);
    expect(normalized?.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(normalized?.gameVersion).toBe(GAME_VERSION);
  });

  it('restores compatible optional v0.2-dev subsystems before validating the state', () => {
    const input = structuredClone(createInitialState()) as unknown as Record<string, unknown>;
    delete input.phone;

    const normalized = normalizePersistedGameState(input);

    expect(normalized).not.toBeNull();
    expect(normalized?.phone.deviceItemId).toBe('phone_01');
  });

  it('rejects an unsupported future schema until an explicit schema migrator is added', () => {
    const input = createInitialState() as ReturnType<typeof createInitialState> & { schemaVersion: number };
    input.schemaVersion = SAVE_SCHEMA_VERSION + 1;
    expect(normalizePersistedGameState(input)).toBeNull();
  });

  it('rejects a structurally inconsistent current-schema save', () => {
    const input = createInitialState();
    input.player.inventoryIds.push('apple_01');
    expect(normalizePersistedGameState(input)).toBeNull();
  });
});
