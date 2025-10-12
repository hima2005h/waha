import {
  Body,
  Controller,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FindChatID } from '@waha/apps/chatwoot/client/ids';
import { EventName, MessageType } from '@waha/apps/chatwoot/client/types';
import { INBOX_CONTACT_CHAT_ID } from '@waha/apps/chatwoot/const';
import { InboxData } from '@waha/apps/chatwoot/consumers/types';
import { ChatWootQueueService } from '@waha/apps/chatwoot/services/ChatWootQueueService';
import { SessionManager } from '@waha/core/abc/manager.abc';
import { AppRepository } from '@waha/apps/app_sdk/storage/AppRepository';

@Controller('webhooks/chatwoot/')
@ApiTags('🧩 Apps')
export class ChatwootWebhookController {
  constructor(
    private readonly chatWootQueueService: ChatWootQueueService,
    private readonly manager: SessionManager,
  ) {}

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

    // Skip if app is disabled or does not exist
    const knex = this.manager.store.getWAHADatabase();
    const repo = new AppRepository(knex);
    const app = await repo.findEnabledAppById(id);
    if (!app || app.session !== session) {
      throw new NotFoundException(`App '${id}' not found`);
    }

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
        // We handle only "retries" on message_update
        // This is the attribute ChatWoot send
        // There's NO other way to identify "status: read" updates right now
        // There's no "body.status" in message_updated webhook :(
        const isRetryNull = body.content_attributes?.external_error === null;
        const isRetrySomething = Boolean(
          body.content_attributes?.external_error,
        );
        const isRetry = isRetryNull || isRetrySomething;
        if (!isRetry) {
          return { success: true };
        }

        if (!isCommandsChat) {
          await this.chatWootQueueService.addMessageUpdatedJob(data);
        } else {
          await this.chatWootQueueService.addCommandsJob(body.event, data);
        }
        return { success: true };
      default:
        // Ignore other events
        await this.chatWootQueueService.addJobToQueue(body.event, data);
        return { success: true };
    }
  }
}
