import { Contact, VCardContact } from '@waha/structures/chatting.dto';

export function toVcard(data: Contact | VCardContact): string {
  if (data.vcard) {
    return data.vcard;
  }
  const contact: Contact = data as any;
  const parts = [];
  parts.push('BEGIN:VCARD');
  parts.push('VERSION:3.0');
  parts.push(`FN:${contact.fullName}`);
  if (contact.organization) {
    parts.push(`ORG:${contact.organization};`);
  }
  if (contact.whatsappId) {
    parts.push(
      `TEL;type=CELL;type=VOICE;waid=${contact.whatsappId}:${contact.phoneNumber}`,
    );
  } else {
    parts.push(`TEL;type=CELL;type=VOICE:${contact.phoneNumber}`);
  }
  parts.push('END:VCARD');
  return parts.join('\n');
}
