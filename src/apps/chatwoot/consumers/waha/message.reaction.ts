import { Processor } from '@nestjs/bullmq';
import { JOB_CONCURRENCY } from '@waha/apps/app_sdk/constants';
import { SendAttachment } from '@waha/apps/chatwoot/client/types';
import { QueueName } from '@waha/apps/chatwoot/consumers/QueueName';
import { EventData } from '@waha/apps/chatwoot/consumers/types';
import {
  ChatWootWAHABaseConsumer,
  IMessageInfo,
} from '@waha/apps/chatwoot/consumers/waha/base';
import { MessageBaseHandler } from '@waha/apps/chatwoot/consumers/waha/base';
import { TKey } from '@waha/apps/chatwoot/locale';
import { WAHASessionAPI } from '@waha/apps/chatwoot/session/WAHASelf';
import { SessionManager } from '@waha/core/abc/manager.abc';
import { parseMessageIdSerialized } from '@waha/core/utils/ids';
import { RMutexService } from '@waha/modules/rmutex/rmutex.service';
import { WAHAEvents } from '@waha/structures/enums.dto';
import { WAMessageReaction, WAReaction } from '@waha/structures/responses.dto';
import { WAHAWebhookMessageReaction } from '@waha/structures/webhooks.dto';
import { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';

@Processor(QueueName.WAHA_MESSAGE_REACTION, { concurrency: JOB_CONCURRENCY })
export class WAHAMessageReactionConsumer extends ChatWootWAHABaseConsumer {
  constructor(
    protected readonly manager: SessionManager,
    log: PinoLogger,
    rmutex: RMutexService,
  ) {
    super(manager, log, rmutex, 'WAHAMessageReactionConsumer');
  }

  GetChatId(event: WAHAWebhookMessageReaction): string {
    return event.payload.from;
  }

  async Process(
    job: Job<EventData, any, WAHAEvents>,
    info: IMessageInfo,
  ): Promise<any> {
    const container = await this.DIContainer(job, job.data.app);
    const event: WAHAWebhookMessageReaction = job.data.event as any;
    const session = new WAHASessionAPI(event.session, container.WAHASelf());
    const handler = new MessageReactionHandler(
      container.MessageMappingService(),
      container.ContactConversationService(),
      container.Logger(),
      info,
      session,
      container.Locale(),
      container.WAHASelf(),
    );
    return await handler.handle(event);
  }
}

export class MessageReactionHandler extends MessageBaseHandler<WAMessageReaction> {
  getContent(payload: WAMessageReaction) {
    const reaction = payload.reaction as WAReaction;
    const emoji = reaction.text;
    if (!emoji) {
      return this.l.key(TKey.WHATSAPP_REACTION_REMOVED).render();
    }
    return this.l.key(TKey.WHATSAPP_REACTION_ADDED).render({
      emoji: emoji,
    });
  }

  getReplyToWhatsAppID(payload: WAMessageReaction) {
    const reaction = payload.reaction as WAReaction;
    const messageId = reaction.messageId;
    const key = parseMessageIdSerialized(messageId, false);
    return key.id;
  }

  async getAttachments(payload: WAMessageReaction): Promise<SendAttachment[]> {
    return [];
  }
}
