import { Processor } from '@nestjs/bullmq';
import { ILogger } from '@waha/apps/app_sdk/ILogger';
import { JOB_CONCURRENCY } from '@waha/apps/app_sdk/constants';
import { ContactConversationService } from '@waha/apps/chatwoot/client/ContactConversationService';
import { QueueName } from '@waha/apps/chatwoot/consumers/QueueName';
import { EventData } from '@waha/apps/chatwoot/consumers/types';
import {
  ChatWootWAHABaseConsumer,
  IMessageInfo,
} from '@waha/apps/chatwoot/consumers/waha/base';
import { WhatsAppContactInfo } from '@waha/apps/chatwoot/contacts/WhatsAppContactInfo';
import { Locale } from '@waha/apps/chatwoot/i18n/locale';
import { WAHASessionAPI } from '@waha/apps/chatwoot/session/WAHASelf';
import { SessionManager } from '@waha/core/abc/manager.abc';
import { RMutexService } from '@waha/modules/rmutex/rmutex.service';
import { WAHAEvents, WAMessageAck } from '@waha/structures/enums.dto';
import { WAHAWebhookMessageAck } from '@waha/structures/webhooks.dto';
import { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import { isJidCusFormat } from '@waha/utils/wa';
import { isLidUser } from '@adiwajshing/baileys/lib/WABinary/jid-utils';

@Processor(QueueName.WAHA_MESSAGE_ACK, { concurrency: JOB_CONCURRENCY })
export class WAHAMessageAckConsumer extends ChatWootWAHABaseConsumer {
  constructor(
    protected readonly manager: SessionManager,
    log: PinoLogger,
    rmutex: RMutexService,
  ) {
    super(manager, log, rmutex, 'WAHAMessageAckConsumer');
  }

  ShouldProcess(event: WAHAWebhookMessageAck): boolean {
    // Mark as seen only if it's DM
    // Ignore groups and other multiple participants chats
    const chatId = this.GetChatId(event);
    if (!isJidCusFormat(chatId) && !isLidUser(chatId)) {
      return false;
    }
    const payload = event.payload;
    if (payload.fromMe) {
      // Ignore from me
      return;
    }
    // Only READ and PLAYED
    return (
      payload.ack === WAMessageAck.READ || payload.ack == WAMessageAck.PLAYED
    );
  }

  GetChatId(event: WAHAWebhookMessageAck): string {
    return event.payload.from;
  }

  async Process(
    job: Job<EventData, any, WAHAEvents>,
    info: IMessageInfo,
  ): Promise<void> {
    const container = await this.DIContainer(job, job.data.app);
    const event = job.data.event as WAHAWebhookMessageAck;
    const session = new WAHASessionAPI(event.session, container.WAHASelf());
    const handler = new MessageAckHandler(
      container.ContactConversationService(),
      container.Logger(),
      info,
      session,
      container.Locale(),
    );
    try {
      await handler.handle(event);
    } catch (e) {
      // TODO: Investigate errors
      // https://github.com/devlikeapro/waha/issues/1492
      this.logger.error(e);
    }
  }
}

class MessageAckHandler {
  constructor(
    private readonly contactConversationService: ContactConversationService,
    private readonly logger: ILogger,
    private readonly info: IMessageInfo,
    private readonly session: WAHASessionAPI,
    private readonly locale: Locale,
  ) {}

  async handle(event: WAHAWebhookMessageAck): Promise<void> {
    const payload = event.payload;
    const contactInfo = WhatsAppContactInfo(
      this.session,
      payload.from,
      this.locale,
    );
    const conversation =
      await this.contactConversationService.ConversationByContact(contactInfo);
    this.info.onConversationId(conversation.conversationId);

    const sourceId = conversation.sourceId;
    if (!sourceId) {
      this.logger.warn(
        `Contact not found for chat.id: ${payload.from}. Skipping read update for message ${payload.id}`,
      );
      return;
    }

    try {
      await this.contactConversationService.markConversationAsRead(
        conversation.conversationId,
        sourceId,
      );
      this.logger.info(
        `Marked conversation ${conversation.conversationId} as read for chat.id: ${payload.from} (message: ${payload.id}, sourceId: ${sourceId})`,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error marking conversation ${conversation.conversationId} as read for chat.id: ${payload.from}. Reason: ${reason}`,
      );
      throw error;
    }
  }
}
