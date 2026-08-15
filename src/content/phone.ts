import type { PhoneState } from '../engine/model';

const INITIAL_PHONE_STATE: PhoneState = {
  deviceItemId: 'phone_01',
  calls: [
    { id: 'call_wife_2241', contactName: 'Épouse', displayTime: 'Dernier appel hier · 22:41', direction: 'outgoing' },
    { id: 'call_alice_1812', contactName: 'Alice', displayTime: 'Hier · 18:12', direction: 'outgoing' },
    { id: 'call_lilou_1809', contactName: 'Lilou', displayTime: 'Hier · 18:09', direction: 'outgoing' },
  ],
  messages: [
    { id: 'msg_wife_1903', contactName: 'Épouse', preview: '« Tu peux penser au pain ? »', displayTime: 'hier 19:03', kind: 'text' },
    { id: 'msg_alice_1748', contactName: 'Alice', preview: '« ok papa »', displayTime: 'hier 17:48', kind: 'text' },
    { id: 'msg_lilou_1731', contactName: 'Lilou', preview: 'Photo', displayTime: 'hier 17:31', kind: 'photo' },
  ],
};

export function createInitialPhoneState(): PhoneState {
  return structuredClone(INITIAL_PHONE_STATE);
}
