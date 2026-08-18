import { PHONE_CONTACTS } from '../../content/phone';
import type { EngineTransition, GameState } from '../model';
import { getPhoneCapabilities } from '../phone';
import { cloneState } from '../state';
import { advanceTime, formatClock } from '../time';
import { failure, success } from './result';

const CALL_SECONDS = 25;
const SMS_SECONDS = 8;
const CALL_BATTERY_COST = 0.12;
const SMS_BATTERY_COST = 0.05;
const FAMILY_SMS = 'Où êtes-vous ? Répondez-moi.';

function phoneContact(contactId: string | undefined): (typeof PHONE_CONTACTS)[number] | undefined {
  return PHONE_CONTACTS.find((contact) => contact.id === contactId);
}

function consumeBattery(state: GameState, amount: number): void {
  const phone = state.items[state.phone.deviceItemId];
  if (!phone || phone.batteryPercent === undefined) return;
  phone.batteryPercent = Math.max(0, phone.batteryPercent - amount);
}

export function callContact(state: GameState, contactId: string | undefined): EngineTransition {
  const contact = phoneContact(contactId);
  if (!contact) return failure(state, 'Impossible', 'Ce contact n’est pas disponible.');
  if (!getPhoneCapabilities(state).canPlaceCall) return failure(state, 'Appel impossible', 'Le téléphone doit être transporté, alimenté et disposer d’un réseau suffisant.');

  const next = cloneState(state);
  consumeBattery(next, CALL_BATTERY_COST);
  advanceTime(next, CALL_SECONDS);
  next.phone.calls.unshift({
    id: `attempt_call_${contact.id}_${next.engine.elapsedSeconds}`,
    contactName: contact.name,
    displayTime: `Aujourd’hui · ${formatClock(next)}`,
    direction: 'outgoing',
  });
  next.player.needs.stress = Math.min(100, next.player.needs.stress + 1);

  return success(
    next,
    `Aucune réponse de ${contact.name}`,
    `L’appel sonne, encore et encore, puis bascule sur la messagerie. Aucun signe de réponse. Votre stress augmente légèrement.`,
    CALL_SECONDS,
  );
}

export function sendSmsContact(state: GameState, contactId: string | undefined): EngineTransition {
  const contact = phoneContact(contactId);
  if (!contact) return failure(state, 'Impossible', 'Ce contact n’est pas disponible.');
  if (!getPhoneCapabilities(state).canSendSms) return failure(state, 'SMS impossible', 'Le téléphone doit être transporté, alimenté et disposer d’un réseau suffisant.');

  const next = cloneState(state);
  consumeBattery(next, SMS_BATTERY_COST);
  advanceTime(next, SMS_SECONDS);
  next.phone.messages.unshift({
    id: `attempt_sms_${contact.id}_${next.engine.elapsedSeconds}`,
    contactName: contact.name,
    preview: `Vous : « ${FAMILY_SMS} »`,
    displayTime: `aujourd’hui · ${formatClock(next)}`,
    kind: 'text',
  });

  return success(
    next,
    `SMS envoyé à ${contact.name}`,
    `« ${FAMILY_SMS} » Le message est parti. Rien ne permet encore de savoir si quelqu’un le lira.`,
    SMS_SECONDS,
  );
}
