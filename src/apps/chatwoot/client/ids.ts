import { isLidUser } from '@adiwajshing/baileys/lib/WABinary/jid-utils';
import { AttributeKey } from '@waha/apps/chatwoot/const';
import { WhatsAppMessage } from '@waha/apps/chatwoot/storage';
import { buildMessageId } from '@waha/core/engines/noweb/session.noweb.core';

export function GetJID(contact: any): string | null {
  return contact?.custom_attributes?.[AttributeKey.WA_JID];
}

export function GetLID(contact: any): string | null {
  return contact?.custom_attributes?.[AttributeKey.WA_LID];
}

export function GetChatID(contact: any): string | null {
  return contact?.custom_attributes?.[AttributeKey.WA_CHAT_ID];
}

export function SerializeWhatsAppKey(message: WhatsAppMessage): string {
  const key = {
    id: message.message_id,
    remoteJid: message.chat_id,
    fromMe: Boolean(message.from_me),
    participant: message.participant,
  };
  return buildMessageId(key);
}

export function ContactAttr(chatId: string): AttributeKey {
  if (isLidUser(chatId)) {
    return AttributeKey.WA_LID;
  } else {
    return AttributeKey.WA_JID;
  }
}
