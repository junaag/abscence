import type { GameState } from './model';

export interface PhoneStateViolation {
  code: string;
  message: string;
}

function violation(code: string, message: string): PhoneStateViolation {
  return { code, message };
}

export function validatePhoneState(state: GameState): PhoneStateViolation[] {
  const errors: PhoneStateViolation[] = [];
  const phone = state.phone;
  const device = state.items[phone.deviceItemId];

  if (!device) errors.push(violation('PHONE_DEVICE_MISSING', `Phone points to missing item ${phone.deviceItemId}.`));
  else if (device.definitionId !== 'smartphone') errors.push(violation('PHONE_DEVICE_INVALID', `${phone.deviceItemId} is not a smartphone.`));

  const callIds = new Set<string>();
  for (const call of phone.calls) {
    if (!call.id.trim()) errors.push(violation('PHONE_CALL_ID_EMPTY', 'Phone call id cannot be empty.'));
    else if (callIds.has(call.id)) errors.push(violation('PHONE_CALL_DUPLICATE_ID', `Duplicate phone call id ${call.id}.`));
    callIds.add(call.id);
    if (!call.contactName.trim()) errors.push(violation('PHONE_CALL_CONTACT_EMPTY', `${call.id || 'call'} has no contact name.`));
    if (!call.displayTime.trim()) errors.push(violation('PHONE_CALL_TIME_EMPTY', `${call.id || 'call'} has no display time.`));
    if (!['incoming', 'outgoing', 'missed'].includes(call.direction)) errors.push(violation('PHONE_CALL_DIRECTION_INVALID', `${call.id || 'call'} has invalid direction.`));
  }

  const messageIds = new Set<string>();
  for (const message of phone.messages) {
    if (!message.id.trim()) errors.push(violation('PHONE_MESSAGE_ID_EMPTY', 'Phone message id cannot be empty.'));
    else if (messageIds.has(message.id)) errors.push(violation('PHONE_MESSAGE_DUPLICATE_ID', `Duplicate phone message id ${message.id}.`));
    messageIds.add(message.id);
    if (!message.contactName.trim()) errors.push(violation('PHONE_MESSAGE_CONTACT_EMPTY', `${message.id || 'message'} has no contact name.`));
    if (!message.preview.trim()) errors.push(violation('PHONE_MESSAGE_PREVIEW_EMPTY', `${message.id || 'message'} has no preview.`));
    if (!message.displayTime.trim()) errors.push(violation('PHONE_MESSAGE_TIME_EMPTY', `${message.id || 'message'} has no display time.`));
    if (!['text', 'photo'].includes(message.kind)) errors.push(violation('PHONE_MESSAGE_KIND_INVALID', `${message.id || 'message'} has invalid kind.`));
  }

  const signalPercent = state.infrastructure.mobile.signalPercent;
  if (signalPercent !== undefined && (!Number.isFinite(signalPercent) || signalPercent < 0 || signalPercent > 100)) {
    errors.push(violation('MOBILE_SIGNAL_PERCENT_INVALID', `Mobile signal percentage must stay between 0 and 100, got ${signalPercent}.`));
  }

  return errors;
}

export function assertValidPhoneState(state: GameState): void {
  const errors = validatePhoneState(state);
  if (errors.length === 0) return;
  throw new Error(`Invalid ABSENCE phone state:\n${errors.map((error) => `${error.code}: ${error.message}`).join('\n')}`);
}
