import { describe, expect, it } from 'vitest';
import { createDefaultUiPreferences, loadUiPreferences, saveUiPreferences, UI_PREFERENCES_KEY } from '../../src/app/preferences';

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

describe('UI preferences', () => {
  it('defaults sound to enabled', () => {
    expect(createDefaultUiPreferences()).toEqual({ soundEnabled: true });
  });

  it('persists sound separately from the game save', () => {
    const storage = new MemoryStorage();
    saveUiPreferences({ soundEnabled: false }, storage);
    expect(loadUiPreferences(storage)).toEqual({ soundEnabled: false });
    expect(storage.getItem(UI_PREFERENCES_KEY)).toBe('{"soundEnabled":false}');
    expect(storage.getItem('absence-v020-dev')).toBeNull();
  });

  it('recovers safely from invalid preference data', () => {
    const storage = new MemoryStorage();
    storage.setItem(UI_PREFERENCES_KEY, '{invalid');
    expect(loadUiPreferences(storage)).toEqual({ soundEnabled: true });
  });
});
