import {
  isJidGroup,
  isJidNewsletter,
  isJidStatusBroadcast,
} from '@adiwajshing/baileys';
import { isLidUser } from '@adiwajshing/baileys/lib/WABinary/jid-utils';
import { public_contact_create_update_payload as Contact } from '@figuro/chatwoot-sdk';
import { ContactInfo } from '@waha/apps/chatwoot/client/ContactConversationService';
import { AttributeKey } from '@waha/apps/chatwoot/const';
import { Locale, TKey } from '@waha/apps/chatwoot/locale';
import { WAHASessionAPI } from '@waha/apps/chatwoot/session/WAHASelf';
import { Channel } from '@waha/structures/channels.dto';
import { CacheAsync } from '@waha/utils/Cache';

/**
 * Base WhatsApp contact info class
 */
abstract class ChatContactInfo implements ContactInfo {
  constructor(
    protected session: WAHASessionAPI,
    protected chatId: string,
    protected locale: Locale,
  ) {}

  ChatId(): string {
    return this.chatId;
  }

  abstract AvatarUrl(): Promise<string | null>;

  abstract Attributes(): Promise<any>;

  abstract PublicContactCreate(): Promise<Contact>;
}

/**
 * Regular JID contact info
 */
class JidContactInfo extends ChatContactInfo {
  @CacheAsync()
  async AvatarUrl(): Promise<string> {
    return await this.session.getChatPicture(this.chatId);
  }

  @CacheAsync()
  async fetchLid() {
    return await this.session.findLIDByPN(this.chatId);
  }

  @CacheAsync()
  async Attributes() {
    const attributes = {
      [AttributeKey.WA_CHAT_ID]: this.chatId,
      [AttributeKey.WA_JID]: this.chatId,
    };
    const lid = await this.fetchLid();
    if (lid) {
      attributes[AttributeKey.WA_LID] = lid;
    }
    return attributes;
  }

  async PublicContactCreate(): Promise<Contact> {
    const contact: any = await this.session.getContact(this.chatId);
    const name =
      contact?.name || contact?.pushName || contact?.pushname || this.chatId;
    const phoneNumber = this.chatId.split('@')[0];
    const phoneNumberE164 = '+' + phoneNumber;

    const result: Contact = {
      name: name,
      custom_attributes: {
        [AttributeKey.WA_CHAT_ID]: this.chatId,
        [AttributeKey.WA_JID]: this.chatId,
      },
      phone_number: phoneNumberE164,
    };
    result.custom_attributes = await this.Attributes();
    return result;
  }
}

/**
 * LID contact info
 */
class LidContactInfo extends ChatContactInfo {
  @CacheAsync()
  async jid() {
    const pn = await this.session.findPNByLid(this.chatId);
    return new JidContactInfo(this.session, pn, this.locale);
  }

  async AvatarUrl(): Promise<string | null> {
    const jid = await this.jid();
    if (jid) {
      return await jid.AvatarUrl();
    }
    return null;
  }

  @CacheAsync()
  async Attributes() {
    const jid = await this.jid();
    let attributes = {};
    if (jid) {
      attributes = await jid.Attributes();
    }
    attributes[AttributeKey.WA_CHAT_ID] = this.chatId;
    attributes[AttributeKey.WA_LID] = this.chatId;
    return attributes;
  }

  async PublicContactCreate(): Promise<Contact> {
    const jid = await this.jid();
    let result;
    if (jid) {
      result = await jid.PublicContactCreate();
    } else {
      result = {
        inbox_id: 0,
        identifier: this.chatId,
        name: this.chatId,
      };
    }
    result.custom_attributes = await this.Attributes();
    return result;
  }
}

/**
 * Group contact info
 */
class GroupContactInfo extends ChatContactInfo {
  @CacheAsync()
  async AvatarUrl(): Promise<string> {
    return await this.session.getChatPicture(this.chatId);
  }

  async Attributes() {
    return {
      [AttributeKey.WA_CHAT_ID]: this.chatId,
    };
  }

  async PublicContactCreate(): Promise<Contact> {
    let name = this.chatId;
    const group: any = await this.session?.getGroup(this.chatId);
    if (group) {
      name = group.subject || group.name || group.topic || name;
      const suffix = this.locale
        .key(TKey.WHATSAPP_CONTACT_GROUP_SUFFIX)
        .render();
      name = `${name} (${suffix})`;
    }

    return {
      identifier: this.chatId,
      name: name,
      custom_attributes: await this.Attributes(),
    };
  }
}

/**
 * Channel (newsletter) contact info
 */
class ChannelContactInfo extends ChatContactInfo {
  @CacheAsync()
  async AvatarUrl(): Promise<string> {
    return await this.session.getChatPicture(this.chatId);
  }

  async Attributes() {
    return {
      [AttributeKey.WA_CHAT_ID]: this.chatId,
    };
  }

  async PublicContactCreate(): Promise<Contact> {
    let name = this.chatId;
    const channel: Channel = await this.session.getChannel(this.chatId);
    if (channel) {
      name = channel.name || name;
      const suffix = this.locale
        .key(TKey.WHATSAPP_CONTACT_CHANNEL_SUFFIX)
        .render();
      name = `${name} (${suffix})`;
    }
    return {
      identifier: this.chatId,
      name: name,
      custom_attributes: await this.Attributes(),
    };
  }
}

/**
 * Status broadcast contact info
 */
class StatusContactInfo extends ChatContactInfo {
  @CacheAsync()
  async AvatarUrl(): Promise<string | null> {
    return null;
  }

  async Attributes() {
    return {
      [AttributeKey.WA_CHAT_ID]: this.chatId,
    };
  }

  async PublicContactCreate(): Promise<Contact> {
    const name = this.locale.key(TKey.WHATSAPP_CONTACT_STATUS_NAME).render();

    return {
      identifier: this.chatId,
      name: `🟢 ${name}`,
      custom_attributes: await this.Attributes(),
    };
  }
}

/**
 * Factory function to get the appropriate ContactInfo implementation
 * based on the chat ID type
 */
export function WhatsAppContactInfo(
  session: WAHASessionAPI,
  chatId: string,
  locale: Locale,
): ContactInfo {
  if (isJidGroup(chatId)) {
    return new GroupContactInfo(session, chatId, locale);
  } else if (isJidNewsletter(chatId)) {
    return new ChannelContactInfo(session, chatId, locale);
  } else if (isJidStatusBroadcast(chatId)) {
    return new StatusContactInfo(session, chatId, locale);
  } else if (isLidUser(chatId)) {
    return new LidContactInfo(session, chatId, locale);
  }
  return new JidContactInfo(session, chatId, locale);
}
