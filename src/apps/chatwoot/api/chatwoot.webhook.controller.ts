import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FindChatID } from '@waha/apps/chatwoot/client/ids';
import { EventName, MessageType } from '@waha/apps/chatwoot/client/types';
import { INBOX_CONTACT_CHAT_ID } from '@waha/apps/chatwoot/const';
import { InboxData } from '@waha/apps/chatwoot/consumers/types';
import { ChatWootQueueService } from '@waha/apps/chatwoot/services/ChatWootQueueService';

@Controller('webhooks/chatwoot/')
@ApiTags('🧩 Apps')
export class ChatwootWebhookController {
  constructor(private readonly chatWootQueueService: ChatWootQueueService) {}

  @Post(':session/:id')
  @ApiOperation({
    summary: 'Chatwoot Webhook',
    description: 'Chatwoot Webhook',
  })
  async webhook(
    @Param('session') session: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    if (!body || !body?.event) {
      return { success: true };
    }

    // Ignore all private notes
    if (body.private) {
      return { success: true };
    }

    // Ignore all incoming messages
    if (body.message_type == MessageType.INCOMING) {
      return { success: true };
    }

    const data: InboxData = {
      session: session,
      app: id,
      body: body,
    };

    // Check if it's a command message (sent to the special inbox contact)
    const sender = body?.conversation?.meta?.sender;
    const chatId = FindChatID(sender);
    const isCommandsChat = chatId === INBOX_CONTACT_CHAT_ID;

    // Check if it's a deleted message
    if (body.content_attributes?.deleted && !isCommandsChat) {
      await this.chatWootQueueService.addMessageDeletedJob(data);
      return { success: true };
    }

    // Route to specific queues based on an event type
    switch (body.event) {
      case EventName.MESSAGE_CREATED:
        if (!isCommandsChat) {
          await this.chatWootQueueService.addMessageCreatedJob(data);
        } else {
          await this.chatWootQueueService.addCommandsJob(body.event, data);
        }
        return { success: true };
      case EventName.MESSAGE_UPDATED:
        if (!isCommandsChat) {
          await this.chatWootQueueService.addMessageUpdatedJob(data);
        } else {
          await this.chatWootQueueService.addCommandsJob(body.event, data);
        }
        return { success: true };
      default:
        // Ignore other events
        return { success: true };
    }
  }
}
