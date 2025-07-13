import { WhatsAppMessage } from '@waha/apps/chatwoot/storage';
import { toCusFormat } from '@waha/core/engines/noweb/session.noweb.core';
import { WAHAEngine } from '@waha/structures/enums.dto';
import { getEngineName } from '@waha/version';
import { Message as MessageInstance } from 'whatsapp-web.js/src/structures';

interface IEngineHelper {
  WhatsAppMessageKeys(message: any): WhatsAppMessage;
}

class NOWEBHelper implements IEngineHelper {
  WhatsAppMessageKeys(message: any): WhatsAppMessage {
    const timestamp = parseInt(message.messageTimestamp) * 1000;
    return {
      timestamp: new Date(timestamp),
      from_me: message.key.fromMe,
      chat_id: toCusFormat(message.key.remoteJid),
      message_id: message.key.id,
      participant: message.key.participant,
    };
  }
}

class GOWSHelper implements IEngineHelper {
  /**
   * Parse API response and get the data
   * API Response depends on engine right now
   */
  WhatsAppMessageKeys(message: any): WhatsAppMessage {
    const Info = message._data.Info;
    const timestamp = new Date(Info.Timestamp).getTime();
    return {
      timestamp: new Date(timestamp),
      from_me: Info.IsFromMe,
      chat_id: toCusFormat(Info.Chat),
      message_id: Info.ID,
      participant: Info.Sender ? toCusFormat(Info.Sender) : null,
    };
  }
}

class WEBJSHelper implements IEngineHelper {
  /**
   * Parse API response and get the data for WEBJS engine
   */
  WhatsAppMessageKeys(message: MessageInstance): WhatsAppMessage {
    return {
      timestamp: new Date(message.timestamp * 1000),
      from_me: message.fromMe,
      chat_id: message.from,
      message_id: message.id.id,
      participant: message.author || null,
    };
  }
}

// Choose the right EngineHelper based on getEngineName() function
let engineHelper: IEngineHelper;

switch (getEngineName()) {
  case WAHAEngine.NOWEB:
    engineHelper = new NOWEBHelper();
    break;
  case WAHAEngine.GOWS:
    engineHelper = new GOWSHelper();
    break;
  case WAHAEngine.WEBJS:
    engineHelper = new WEBJSHelper();
    break;
  default:
    engineHelper = new WEBJSHelper(); // Default to WEBJS as it's the default engine
}

export const EngineHelper = engineHelper;
