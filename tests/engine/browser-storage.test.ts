import { describe, expect, it, vi } from 'vitest';
import { createBrowserPersistence } from '../../src/app/storage';
import { createInitialState } from '../../src/engine/state';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  readonly failReads: boolean;
  readonly failWrites: boolean;

  constructor(options: { failReads?: boolean; failWrites?: boolean } = {}) {
    this.failReads = Boolean(options.failReads);
    this.failWrites = Boolean(options.failWrites);
  }

  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  getItem(key: string): string | null {
    if (this.failReads) throw new DOMException('blocked', 'SecurityError');
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    if (this.failWrites) throw new DOMException('quota', 'QuotaExceededError');
    this.values.set(key, value);
  }
}

describe('browser persistence failure boundary', () => {
  it('starts from a valid fresh state when browser storage reads are blocked', () => {
    const persistence = createBrowserPersistence(new MemoryStorage({ failReads: true }));
    const state = persistence.load();

    expect(state.player.locationId).toBe('bedroom');
    expect(state.player.healthPv).toBe(100);
    expect(persistence.hasStorageFailure()).toBe(true);
  });

  it('returns false instead of crashing the app when a valid game save cannot be written', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const persistence = createBrowserPersistence(new MemoryStorage({ failWrites: true }));

    expect(persistence.save(createInitialState())).toBe(false);
    expect(persistence.hasStorageFailure()).toBe(true);
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it('does not hide engine invariant failures behind the storage boundary', () => {
    const persistence = createBrowserPersistence(new MemoryStorage({ failWrites: true }));
    const invalid = createInitialState();
    invalid.player.healthPv = 101;

    expect(() => persistence.save(invalid)).toThrow();
    expect(persistence.hasStorageFailure()).toBe(false);
  });

  it('handles preference and map write failures with the same non-blocking contract', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const persistence = createBrowserPersistence(new MemoryStorage({ failWrites: true }));

    expect(persistence.savePreferences({ soundEnabled: false })).toBe(false);
    expect(persistence.saveMapState(persistence.loadMapState())).toBe(false);
    expect(persistence.hasStorageFailure()).toBe(true);

    errorSpy.mockRestore();
  });
});
