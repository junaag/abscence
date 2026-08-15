import { createInitialPhoneState } from '../content/phone';
import type { GameState, PhoneCallRecord, PhoneMessageRecord, PhoneState } from './model';

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
