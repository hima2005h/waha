import { WAMessageKey } from '@adiwajshing/baileys';
import {
  parseMessageIdSerialized,
  toJID,
} from '@waha/core/engines/noweb/session.noweb.core';
import { SendSeenRequest } from '@waha/structures/chatting.dto';

export function ExtractMessageKeysForRead(
  request: SendSeenRequest,
): WAMessageKey[] {
  const jid = toJID(request.chatId);
  const defaults = {
    remoteJid: jid,
    participant: request.participant,
  };
  const ids = request.messageIds || [];
  if (request.messageId) {
    ids.push(request.messageId);
  }
  const keys: WAMessageKey[] = [];
  for (const messageId of ids) {
    const parsed = parseMessageIdSerialized(messageId, false);
    if (parsed.fromMe) {
      continue;
    }
    const key: WAMessageKey = {
      id: parsed.id,
      remoteJid: parsed.remoteJid
        ? toJID(parsed.remoteJid)
        : defaults.remoteJid,
      participant: parsed.participant
        ? toJID(parsed.participant)
        : defaults.participant,
    };
    keys.push(key);
  }
  return keys;
}

export function isJidCus(jid: string) {
  return jid?.endsWith('@c.us');
}
