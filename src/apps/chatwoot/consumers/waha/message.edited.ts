import { Processor } from '@nestjs/bullmq';
import { JOB_CONCURRENCY } from '@waha/apps/app_sdk/constants';
import { QueueName } from '@waha/apps/chatwoot/consumers/QueueName';
import { EventData } from '@waha/apps/chatwoot/consumers/types';
import {
  ChatWootWAHABaseConsumer,
  IMessageInfo,
} from '@waha/apps/chatwoot/consumers/waha/base';
import { MessageBaseHandler } from '@waha/apps/chatwoot/consumers/waha/base';
import { TKey } from '@waha/apps/chatwoot/locale';
import { WhatsappToMarkdown } from '@waha/apps/chatwoot/text';
import { SessionManager } from '@waha/core/abc/manager.abc';
import { RMutexService } from '@waha/modules/rmutex/rmutex.service';
import { WAHAEvents } from '@waha/structures/enums.dto';
import {
  WAHAWebhookMessageEdited,
  WAMessageEditedBody,
} from '@waha/structures/webhooks.dto';
import { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';

import { SendAttachment } from '../../client/types';
import { WAHASessionAPI } from '../../session/WAHASelf';

@Processor(QueueName.WAHA_MESSAGE_EDITED, { concurrency: JOB_CONCURRENCY })
export class WAHAMessageEditedConsumer extends ChatWootWAHABaseConsumer {
  constructor(
    protected readonly manager: SessionManager,
    log: PinoLogger,
    rmutex: RMutexService,
  ) {
    super(manager, log, rmutex, 'WAHAMessageEditedConsumer');
  }

  GetChatId(event: WAHAWebhookMessageEdited): string {
    return event.payload.from;
  }

  async Process(
    job: Job<EventData, any, WAHAEvents>,
    info: IMessageInfo,
  ): Promise<any> {
    const container = await this.DIContainer(job, job.data.app);
    const event: WAHAWebhookMessageEdited = job.data.event as any;
    const session = new WAHASessionAPI(event.session, container.WAHASelf());
    const handler = new MessageEditedHandler(
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

class MessageEditedHandler extends MessageBaseHandler<WAMessageEditedBody> {
  getContent(payload: WAMessageEditedBody): string {
    const body = payload.body;
    const formatted = WhatsappToMarkdown(body);
    return this.l
      .key(TKey.MESSAGE_EDITED_IN_WHATSAPP)
      .render({ text: formatted });
  }

  getReplyToWhatsAppID(payload: WAMessageEditedBody): string {
    return payload.editedMessageId;
  }

  async getAttachments(
    payload: WAMessageEditedBody,
  ): Promise<SendAttachment[]> {
    return [];
  }
}
