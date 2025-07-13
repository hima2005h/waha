import type { conversation_message_create } from '@figuro/chatwoot-sdk/dist/models/conversation_message_create';
import { Processor } from '@nestjs/bullmq';
import { JOB_CONCURRENCY } from '@waha/apps/app_sdk/constants';
import { ContactConversationService } from '@waha/apps/chatwoot/client/ContactConversationService';
import { AttachmentFromBuffer } from '@waha/apps/chatwoot/client/messages';
import { MessageType } from '@waha/apps/chatwoot/client/types';
import { QueueName } from '@waha/apps/chatwoot/consumers/QueueName';
import { EventData } from '@waha/apps/chatwoot/consumers/types';
import {
  ChatWootWAHABaseConsumer,
  IMessageInfo,
} from '@waha/apps/chatwoot/consumers/waha/base';
import { Locale, TKey } from '@waha/apps/chatwoot/locale';
import { WAHASelf } from '@waha/apps/chatwoot/session/WAHASelf';
import { SessionStatusEmoji } from '@waha/apps/chatwoot/SessionStatusEmoji';
import { SessionManager } from '@waha/core/abc/manager.abc';
import { RMutexService } from '@waha/modules/rmutex/rmutex.service';
import { WAHAEvents, WAHASessionStatus } from '@waha/structures/enums.dto';
import { WAHAWebhookSessionStatus } from '@waha/structures/webhooks.dto';
import { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';

@Processor(QueueName.WAHA_SESSION_STATUS, { concurrency: JOB_CONCURRENCY })
export class WAHASessionStatusConsumer extends ChatWootWAHABaseConsumer {
  constructor(
    protected readonly manager: SessionManager,
    log: PinoLogger,
    rmutex: RMutexService,
  ) {
    super(manager, log, rmutex, 'WAHASessionStatusConsumer');
  }

  GetChatId(event: any): string {
    return 'session.status';
  }

  async Process(
    job: Job<EventData, any, WAHAEvents>,
    info: IMessageInfo,
  ): Promise<any> {
    const container = await this.DIContainer(job, job.data.app);
    const handler = new SessionStatusHandler(
      container.ContactConversationService(),
      container.Locale(),
      container.WAHASelf(),
    );
    return await handler.handle(job.data.event as any);
  }
}

export class SessionStatusHandler {
  constructor(
    private repo: ContactConversationService,
    private l: Locale,
    private waha: WAHASelf,
  ) {}

  async handle(data: WAHAWebhookSessionStatus) {
    const conversation = await this.repo.InboxNotifications();
    // Report session status
    const emoji = SessionStatusEmoji(data.payload.status);
    const activity = this.l.key(TKey.APP_SESSION_STATUS_CHANGE).r({
      emoji: emoji,
      session: data.session,
      status: data.payload.status,
    });
    await conversation.activity(activity);

    const payload = data.payload;
    let text = '';
    switch (payload.status) {
      case WAHASessionStatus.STARTING:
        break;
      case WAHASessionStatus.WORKING:
        text = this.l.key(TKey.APP_SESSION_STATUS_WORKING).r({
          name: data.me?.pushName || 'Unknown',
          id: data.me?.id || 'No phone number',
        });
        break;
      case WAHASessionStatus.STOPPED:
      case WAHASessionStatus.FAILED:
        text = this.l.key(TKey.APP_SESSION_STATUS_ERROR).r();
        text += '\n\n';
        text += this.l.key(TKey.APP_HELP_REMINDER).r();
        text += '\n\n';
        break;
      case WAHASessionStatus.SCAN_QR_CODE:
        text = this.l.key(TKey.APP_SESSION_SCAN_QR_CODE).r();
    }
    if (text) {
      const message: conversation_message_create = {
        content: text,
        message_type: MessageType.INCOMING as any,
      };
      await conversation.send(message);
    }

    // Send QR to the inbox
    if (payload.status === WAHASessionStatus.SCAN_QR_CODE) {
      const buffer = await this.waha.qr(data.session);
      const message = AttachmentFromBuffer(buffer, 'qr.jpg');
      message.message_type = MessageType.INCOMING;
      return await conversation.send(message);
    }
  }
}
