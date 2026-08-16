import { createInitialPhoneState, PHONE_CONTACTS } from '../content/phone';
import { getMobileNetworkState } from './infrastructure';
import type { GameState, PhoneCallRecord, PhoneMessageRecord, PhoneState } from './model';

export interface PhoneCapabilities {
  devicePresent: boolean;
  powered: boolean;
  batteryPercent: number;
  signalPercent: number;
  signalBars: number;
  canReadLocalHistory: boolean;
  canPlaceCall: boolean;
  canSendSms: boolean;
  canUseData: boolean;
}

export interface PhoneContactOption {
  id: string;
  name: string;
}

export function ensurePhoneState(state: GameState): PhoneState {
  const candidate = (state as GameState & { phone?: PhoneState }).phone;
  if (candidate && Array.isArray(candidate.calls) && Array.isArray(candidate.messages)) return candidate;
  const phone = createInitialPhoneState();
  (state as GameState & { phone?: PhoneState }).phone = phone;
  return phone;
}

export function phoneCalls(state: GameState): readonly PhoneCallRecord[] {
  return state.phone.calls;
}

export function phoneMessages(state: GameState): readonly PhoneMessageRecord[] {
  return state.phone.messages;
}

export function phoneDeviceItemId(state: GameState): string {
  return state.phone.deviceItemId;
}

export function phoneContacts(): readonly PhoneContactOption[] {
  return PHONE_CONTACTS;
}

/**
 * Pure engine projection of what the current phone can actually do.
 * Local history needs a carried, powered device but never needs mobile service.
 * Network actions use the historical v0.1.8 thresholds: SMS 10 %, calls 20 %, data 30 %.
 */
export function getPhoneCapabilities(state: GameState): PhoneCapabilities {
  const device = state.items[state.phone.deviceItemId];
  const devicePresent = Boolean(device && device.location.kind === 'inventory');
  const batteryPercent = Math.max(0, Math.min(100, device?.batteryPercent ?? 0));
  const powered = devicePresent && batteryPercent > 0;
  const mobile = getMobileNetworkState(state);

  return {
    devicePresent,
    powered,
    batteryPercent,
    signalPercent: mobile.signalPercent,
    signalBars: mobile.signalBars,
    canReadLocalHistory: powered,
    canPlaceCall: powered && mobile.callsAvailable,
    canSendSms: powered && mobile.smsAvailable,
    canUseData: powered && mobile.dataAvailable,
  };
}
