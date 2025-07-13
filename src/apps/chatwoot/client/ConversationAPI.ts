import { public_conversation } from '@figuro/chatwoot-sdk';
import { ILogger } from '@waha/apps/app_sdk/ILogger';
import {
  ChatWootAPIConfig,
  ChatWootInboxAPI,
} from '@waha/apps/chatwoot/client/interfaces';

export class ConversationAPI {
  constructor(
    private config: ChatWootAPIConfig,
    private inboxAPI: ChatWootInboxAPI,
    private logger: ILogger,
  ) {}

  private async find(
    contactIdentifier: string,
  ): Promise<public_conversation | null> {
    const request = {
      inboxIdentifier: this.config.inboxIdentifier,
      contactIdentifier: contactIdentifier,
    };
    const conversations = await this.inboxAPI.conversations.list(request);
    if (conversations.length != 0) {
      return conversations[0];
    }
    return null;
  }

  private async create(
    contactIdentifier: string,
  ): Promise<public_conversation> {
    const conversation = await this.inboxAPI.conversations.create({
      inboxIdentifier: this.config.inboxIdentifier,
      contactIdentifier: contactIdentifier,
    });
    this.logger.info(
      `Created conversation.id: ${conversation.id} for contact.id: ${contactIdentifier}`,
    );
    return conversation;
  }

  async upsert(contactIdentifier: string): Promise<public_conversation> {
    let conversation = await this.find(contactIdentifier);
    if (!conversation) {
      conversation = await this.create(contactIdentifier);
    }
    this.logger.info(
      `Using conversation.id: ${conversation.id} for contact.id: ${contactIdentifier}`,
    );
    return conversation;
  }
}
