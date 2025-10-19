/**
 * Proto WhatsApp Utils
 */

import { normalizeMessageContent, proto } from '@adiwajshing/baileys';

export function IsEditedMessage(message: proto.IMessage): boolean {
  message = normalizeMessageContent(message);
  if (!message) {
    return false;
  }
  if (
    message?.protocolMessage?.type !==
    proto.Message.ProtocolMessage.Type.MESSAGE_EDIT
  ) {
    return false;
  }
  if (message?.protocolMessage?.editedMessage == null) {
    return false;
  }
  return true;
}
