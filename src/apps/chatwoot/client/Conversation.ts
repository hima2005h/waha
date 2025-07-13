import ChatwootClient from '@figuro/chatwoot-sdk';
import type { conversation_message_create } from '@figuro/chatwoot-sdk/dist/models/conversation_message_create';
import { MessageType } from '@waha/apps/chatwoot/client/types';

export class Conversation {
  public onError: (e: any) => void;

  constructor(
    private accountAPI: ChatwootClient,
    private accountId: number,
    public conversationId: number,
  ) {}

  public async send(data: conversation_message_create) {
    try {
      const message = await this.accountAPI.messages.create({
        accountId: this.accountId,
        conversationId: this.conversationId,
        data: data,
      });
      return message;
    } catch (err) {
      if (this.onError) {
        this.onError(err);
      }
      throw err;
    }
  }

  public async incoming(text: string) {
    const data: conversation_message_create = {
      content: text,
      message_type: MessageType.INCOMING as any,
    };
    return this.send(data);
  }

  public async activity(text: string) {
    const data: conversation_message_create = {
      content: text,
      message_type: MessageType.ACTIVITY as any,
    };
    return this.send(data);
  }

  public async outgoing(text: string) {
    const data: conversation_message_create = {
      content: text,
      message_type: MessageType.OUTGOING as any,
    };
    return this.send(data);
  }
}
