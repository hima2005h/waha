import { isJidGroup, isJidMetaIa } from '@adiwajshing/baileys';
import {
  isJidBroadcast,
  isLidUser,
} from '@adiwajshing/baileys/lib/WABinary/jid-utils';

export function isJidNewsletter(jid: string) {
  return jid.endsWith('@newsletter');
}

export function isJidCus(jid: string) {
  return jid?.endsWith('@c.us');
}

/**
 * Convert from 11111111111@c.us to 11111111111@s.whatsapp.net
 * @param chatId
 */
export function toJID(chatId) {
  if (isJidGroup(chatId)) {
    return chatId;
  }
  if (isJidBroadcast(chatId)) {
    return chatId;
  }
  if (isJidNewsletter(chatId)) {
    return chatId;
  }
  if (isLidUser(chatId)) {
    return chatId;
  }
  if (isJidMetaIa(chatId)) {
    return chatId;
  }
  const number = chatId.split('@')[0];
  return number + '@s.whatsapp.net';
}
