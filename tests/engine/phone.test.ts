import { describe, expect, it } from 'vitest';
import { performAction } from '../../src/engine/actions';
import { loadState, SAVE_KEY } from '../../src/engine/persistence';
import { getPhoneCapabilities, phoneCalls, phoneDeviceItemId, phoneMessages } from '../../src/engine/phone';
import { createInitialState } from '../../src/engine/state';

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

function withPhoneCarried() {
  const state = createInitialState();
  const transition = performAction(state, { id: 'TAKE_ITEM', targetId: 'phone_01' });
  if (!transition.result.success) throw new Error('phone could not be taken');
  return transition.state;
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

  it('normalizes a current prologue save that does not yet contain phone state', () => {
    const storage = new MemoryStorage();
    const legacy = createInitialState() as ReturnType<typeof createInitialState> & { phone?: unknown };
    delete legacy.phone;
    storage.setItem(SAVE_KEY, JSON.stringify(legacy));

    const loaded = loadState(storage);
    expect(loaded.phone.deviceItemId).toBe('phone_01');
    expect(loaded.phone.calls).toHaveLength(3);
    expect(loaded.phone.messages).toHaveLength(3);
  });

  it('has no usable phone capabilities before the device is found and carried', () => {
    const state = createInitialState();
    expect(getPhoneCapabilities(state)).toMatchObject({
      devicePresent: false,
      powered: false,
      signalPercent: 100,
      signalBars: 4,
      canReadLocalHistory: false,
      canPlaceCall: false,
      canSendSms: false,
      canUseData: false,
    });
  });

  it('derives full phone capabilities after the device is picked up', () => {
    const state = withPhoneCarried();
    expect(getPhoneCapabilities(state)).toMatchObject({
      devicePresent: true,
      powered: true,
      signalPercent: 100,
      signalBars: 4,
      canReadLocalHistory: true,
      canPlaceCall: true,
      canSendSms: true,
      canUseData: true,
    });
  });

  it('places a real outgoing family call with time battery history and stress consequences', () => {
    const state = withPhoneCarried();
    const initialBattery = state.items.phone_01?.batteryPercent ?? 0;
    const initialStress = state.player.needs.stress;
    const transition = performAction(state, { id: 'CALL_CONTACT', targetId: 'wife' });

    expect(transition.result.success).toBe(true);
    expect(transition.result.elapsedSeconds).toBe(25);
    expect(transition.state.phone.calls[0]).toMatchObject({ contactName: 'Épouse', direction: 'outgoing' });
    expect(transition.state.phone.calls[0]?.displayTime).toContain('Aujourd’hui · 07:12');
    expect(transition.state.items.phone_01?.batteryPercent).toBeLessThan(initialBattery);
    expect(transition.state.player.needs.stress).toBeGreaterThan(initialStress);
  });

  it('sends the family search SMS as persistent phone history', () => {
    const state = withPhoneCarried();
    const transition = performAction(state, { id: 'SEND_SMS_CONTACT', targetId: 'alice' });

    expect(transition.result.success).toBe(true);
    expect(transition.result.elapsedSeconds).toBe(8);
    expect(transition.state.phone.messages[0]).toMatchObject({
      contactName: 'Alice',
      preview: 'Vous : « Où êtes-vous ? Répondez-moi. »',
      kind: 'text',
    });
    expect(transition.state.phone.messages[0]?.displayTime).toContain('aujourd’hui · 07:12');
  });

  it('keeps local history offline while communications follow the mobile network', () => {
    const state = withPhoneCarried();
    state.infrastructure.mobile.available = false;
    state.infrastructure.mobile.signalPercent = 0;
    state.infrastructure.mobile.signal = 0;
    expect(getPhoneCapabilities(state)).toMatchObject({
      powered: true,
      canReadLocalHistory: true,
      canPlaceCall: false,
      canSendSms: false,
      canUseData: false,
    });
    const failedCall = performAction(state, { id: 'CALL_CONTACT', targetId: 'wife' });
    expect(failedCall.result.success).toBe(false);
    expect(failedCall.state).toBe(state);
  });

  it('uses the exact v0.1.8 SMS/call/data signal thresholds', () => {
    const state = withPhoneCarried();
    state.infrastructure.mobile.available = true;

    state.infrastructure.mobile.signalPercent = 15;
    expect(getPhoneCapabilities(state)).toMatchObject({ canSendSms: true, canPlaceCall: false, canUseData: false });

    state.infrastructure.mobile.signalPercent = 25;
    expect(getPhoneCapabilities(state)).toMatchObject({ canSendSms: true, canPlaceCall: true, canUseData: false });

    state.infrastructure.mobile.signalPercent = 35;
    expect(getPhoneCapabilities(state)).toMatchObject({ canSendSms: true, canPlaceCall: true, canUseData: true });
  });

  it('blocks all phone operations when the carried device battery is empty', () => {
    const state = withPhoneCarried();
    const phone = state.items.phone_01;
    if (!phone) throw new Error('missing phone');
    phone.batteryPercent = 0;
    expect(getPhoneCapabilities(state)).toMatchObject({
      powered: false,
      canReadLocalHistory: false,
      canPlaceCall: false,
      canSendSms: false,
      canUseData: false,
    });
  });
});
