import { describe, expect, it } from 'vitest';
import { loadState, saveState, SAVE_KEY } from '../../src/engine/persistence';
import { validatePhoneState } from '../../src/engine/phone-validation';
import { createInitialState } from '../../src/engine/state';

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

describe('phone persistence validation', () => {
  it('accepts the canonical initial phone state', () => {
    expect(validatePhoneState(createInitialState())).toEqual([]);
  });

  it('rejects a phone bound to a non-smartphone item', () => {
    const state = createInitialState();
    state.phone.deviceItemId = 'water_01';
    expect(validatePhoneState(state).map((error) => error.code)).toContain('PHONE_DEVICE_INVALID');
  });

  it('rejects duplicate call and message ids', () => {
    const state = createInitialState();
    state.phone.calls.push({ ...state.phone.calls[0]!, contactName: 'Duplicata' });
    state.phone.messages.push({ ...state.phone.messages[0]!, contactName: 'Duplicata' });
    const codes = validatePhoneState(state).map((error) => error.code);
    expect(codes).toContain('PHONE_CALL_DUPLICATE_ID');
    expect(codes).toContain('PHONE_MESSAGE_DUPLICATE_ID');
  });

  it('rejects an invalid mobile signal percentage', () => {
    const state = createInitialState();
    state.infrastructure.mobile.signalPercent = 120;
    expect(validatePhoneState(state).map((error) => error.code)).toContain('MOBILE_SIGNAL_PERCENT_INVALID');
  });

  it('refuses to save corrupted phone state', () => {
    const state = createInitialState();
    state.phone.messages[0]!.contactName = '';
    expect(() => saveState(state, new MemoryStorage())).toThrow(/PHONE_MESSAGE_CONTACT_EMPTY/);
  });

  it('recovers from a structurally corrupted persisted phone state', () => {
    const storage = new MemoryStorage();
    const state = createInitialState();
    state.phone.deviceItemId = 'missing_phone';
    storage.setItem(SAVE_KEY, JSON.stringify(state));
    const loaded = loadState(storage);
    expect(loaded.phone.deviceItemId).toBe('phone_01');
    expect(validatePhoneState(loaded)).toEqual([]);
  });
});
