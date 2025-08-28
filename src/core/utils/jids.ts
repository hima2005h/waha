import {
  isJidGroup,
  isJidMetaIa,
  isJidStatusBroadcast,
} from '@adiwajshing/baileys';
import {
  isJidBroadcast,
  isLidUser,
} from '@adiwajshing/baileys/lib/WABinary/jid-utils';

export function isJidNewsletter(jid: string) {
  return jid?.endsWith('@newsletter');
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

export interface IgnoreJidConfig {
  status: boolean;
  groups: boolean;
  channels: boolean;
}

export class JidFilter {
  constructor(public ignore: IgnoreJidConfig) {}

  include(jid: string): boolean {
    if (this.ignore.status && isJidStatusBroadcast(jid)) {
      return false;
    } else if (this.ignore.groups && isJidGroup(jid)) {
      return false;
    } else if (this.ignore.channels && isJidNewsletter(jid)) {
      return false;
    }
    return true;
  }
}
