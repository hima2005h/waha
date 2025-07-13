import ChatwootClient, {
  ApiError,
  public_contact_create_update_payload,
  public_conversation,
} from '@figuro/chatwoot-sdk';
import { ILogger } from '@waha/apps/app_sdk/ILogger';
import { ContactAPI } from '@waha/apps/chatwoot/client/ContactAPI';
import { Conversation } from '@waha/apps/chatwoot/client/Conversation';
import { ConversationAPI } from '@waha/apps/chatwoot/client/ConversationAPI';
import { ChatWootAPIConfig } from '@waha/apps/chatwoot/client/interfaces';
import { InboxContactInfo } from '@waha/apps/chatwoot/contacts/InboxContactInfo';
import { Locale } from '@waha/apps/chatwoot/locale';

import { CacheForConfig } from '../cache/ConversationCache';
import { IConversationCache } from '../cache/IConversationCache';

export interface ContactInfo {
  ChatId(): string;

  AvatarUrl(): Promise<string | null>;

  Attributes(): Promise<any>;

  PublicContactCreate(): Promise<public_contact_create_update_payload>;
}

export class ContactConversationService {
  private cache: IConversationCache;

  constructor(
    private config: ChatWootAPIConfig,
    private contactAPI: ContactAPI,
    private conversationAPI: ConversationAPI,
    private accountAPI: ChatwootClient,
    private logger: ILogger,
    private l: Locale,
  ) {
    this.cache = CacheForConfig(config);
  }

  private async upsertByContactInfo(
    contactInfo: ContactInfo,
  ): Promise<public_conversation> {
    const chatId = contactInfo.ChatId();

    // Check cache for chat id
    if (this.cache.has(chatId)) {
      return this.cache.get(chatId);
    }

    //
    // Find or create contact
    //
    let contact = await this.contactAPI.searchByAnyID(chatId);
    if (!contact) {
      const request = await contactInfo.PublicContactCreate();
      contact = await this.contactAPI.create(chatId, request);
    }

    // Update custom attributes - always
    const attributes = await contactInfo.Attributes();
    this.logger.info(
      `Updating contact custom attributes for chat.id: ${chatId}, contact.id: ${contact.data.id}`,
    );
    await this.contactAPI.updateCustomAttributes(contact.data, attributes);

    // Update Avatar if nothing, but keep the original one if any
    if (!contact.data.thumbnail) {
      const avatarUrl = await contactInfo.AvatarUrl();
      if (avatarUrl) {
        this.contactAPI.updateAvatarUrlSafe(contact.data.id, avatarUrl);
      }
    }

    this.logger.info(
      `Using contact for chat.id: ${chatId}, contact.id: ${contact.sourceId}`,
    );

    //
    // Get or create a conversation for this inbox
    //
    const conversation = await this.conversationAPI.upsert(contact.sourceId);
    this.logger.info(
      `Using conversation for chat.id: ${chatId}, conversation.id: ${conversation.id}, contact.id: ${contact.sourceId}`,
    );

    // Save to cache
    this.cache.set(chatId, conversation);
    return conversation;
  }

  public async ConversationByContact(
    contactInfo: ContactInfo,
  ): Promise<Conversation> {
    const chatId = contactInfo.ChatId();
    const publicConversation = await this.upsertByContactInfo(contactInfo);
    const conversation = new Conversation(
      this.accountAPI,
      this.config.accountId,
      publicConversation.id,
    );
    conversation.onError = (err) => {
      if (err instanceof ApiError) {
        // invalidate cache
        this.cache.delete(chatId);
        this.logger.error(`ApiError: ${err.message}`);
        this.logger.error(
          `ApiError occurred, invalidating cache for chat.id: ${chatId}, conversation.id: ${publicConversation.id}`,
        );
      }
    };
    return conversation;
  }

  public ConversationById(conversationId: number): Conversation {
    return new Conversation(
      this.accountAPI,
      this.config.accountId,
      conversationId,
    );
  }

  /**
   * Build specific contact for inbox notifications
   * @constructor
   */
  public async InboxNotifications() {
    return this.ConversationByContact(new InboxContactInfo(this.l));
  }
}
