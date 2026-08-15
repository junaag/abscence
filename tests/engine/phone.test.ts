import { describe, expect, it } from 'vitest';
import { loadState, SAVE_KEY } from '../../src/engine/persistence';
import { phoneCalls, phoneDeviceItemId, phoneMessages } from '../../src/engine/phone';
import { createInitialState } from '../../src/engine/state';

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

describe('phone state', () => {
  it('stores historical calls and messages in GameState instead of the UI', () => {
    const state = createInitialState();
    expect(phoneDeviceItemId(state)).toBe('phone_01');
    expect(phoneCalls(state).map((call) => [call.contactName, call.displayTime])).toEqual([
      ['Épouse', 'Dernier appel hier · 22:41'],
      ['Alice', 'Hier · 18:12'],
      ['Lilou', 'Hier · 18:09'],
    ]);
    expect(phoneMessages(state).map((message) => [message.contactName, message.preview, message.displayTime])).toEqual([
      ['Épouse', '« Tu peux penser au pain ? »', 'hier 19:03'],
      ['Alice', '« ok papa »', 'hier 17:48'],
      ['Lilou', 'Photo', 'hier 17:31'],
    ]);
  });

  it('keeps phone history mutable as world state and independent from rendering constants', () => {
    const state = createInitialState();
    state.phone.messages[0]!.preview = 'Message modifié par le moteur';
    expect(phoneMessages(state)[0]?.preview).toBe('Message modifié par le moteur');
  });

  it('migrates an older v0.2-dev save that does not yet contain phone state', () => {
    const storage = new MemoryStorage();
    const legacy = createInitialState() as ReturnType<typeof createInitialState> & { phone?: unknown };
    delete legacy.phone;
    storage.setItem(SAVE_KEY, JSON.stringify(legacy));

    const loaded = loadState(storage);
    expect(loaded.phone.deviceItemId).toBe('phone_01');
    expect(loaded.phone.calls).toHaveLength(3);
    expect(loaded.phone.messages).toHaveLength(3);
  });
});
