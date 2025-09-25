import ChatwootClient, { contact_conversations } from '@figuro/chatwoot-sdk';
import { ILogger } from '@waha/apps/app_sdk/ILogger';
import {
  ChatWootAPIConfig,
  ChatWootInboxAPI,
} from '@waha/apps/chatwoot/client/interfaces';
import type { conversation } from '@figuro/chatwoot-sdk/dist/models/conversation';
import * as lodash from 'lodash';

export type ConversationResult = Pick<conversation, 'id' | 'account_id'>;

export interface ContactIds {
  id: number;
  sourceId: string;
}

export class ConversationAPI {
  constructor(
    private config: ChatWootAPIConfig,
    private accountAPI: ChatwootClient,
    private inboxAPI: ChatWootInboxAPI,
    private logger: ILogger,
  ) {}

  private async find(contact: ContactIds): Promise<ConversationResult | null> {
    const result: { payload: contact_conversations } =
      (await this.accountAPI.contacts.listConversations({
        accountId: this.config.accountId,
        id: contact.id,
      })) as any;
    const conversationsForInbox = lodash.filter(result.payload, {
      inbox_id: this.config.inboxId,
    }) as contact_conversations;
    if (conversationsForInbox.length == 0) {
      return null;
    }
    return conversationsForInbox[0];
  }

  private async create(contact: ContactIds): Promise<ConversationResult> {
    const conversation = await this.inboxAPI.conversations.create({
      inboxIdentifier: this.config.inboxIdentifier,
      contactIdentifier: contact.sourceId,
    });
    this.logger.info(
      `Created conversation.id: ${conversation.id} for contact.id: ${contact.id}, contact.sourceId: ${contact.sourceId}`,
    );
    return conversation;
  }

  async upsert(contact: ContactIds): Promise<ConversationResult> {
    let conversation = await this.find(contact);
    if (!conversation) {
      conversation = await this.create(contact);
    }
    this.logger.info(
      `Using conversation.id: ${conversation.id} for contact.id: ${contact.id}, contact.sourceId: ${contact.sourceId}`,
    );
    return conversation;
  }
}
