import { Processor } from '@nestjs/bullmq';
import { JOB_CONCURRENCY } from '@waha/apps/app_sdk/constants';
import { SendAttachment } from '@waha/apps/chatwoot/client/types';
import { QueueName } from '@waha/apps/chatwoot/consumers/QueueName';
import { EventData } from '@waha/apps/chatwoot/consumers/types';
import {
  ChatWootMessagePartial,
  ChatWootWAHABaseConsumer,
  IMessageInfo,
  MessageBaseHandler,
} from '@waha/apps/chatwoot/consumers/waha/base';
import { WAHASessionAPI } from '@waha/apps/chatwoot/session/WAHASelf';
import { WhatsappToMarkdown } from '@waha/apps/chatwoot/text';
import { SessionManager } from '@waha/core/abc/manager.abc';
import { parseMessageIdSerialized } from '@waha/core/utils/ids';
import { RMutexService } from '@waha/modules/rmutex/rmutex.service';
import { WAHAEvents } from '@waha/structures/enums.dto';
import { WAMessage } from '@waha/structures/responses.dto';
import { WAHAWebhookMessageAny } from '@waha/structures/webhooks.dto';
import { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import { TKey } from '@waha/apps/chatwoot/i18n/templates';
import { JobLink } from '@waha/apps/app_sdk/JobUtils';
import { proto } from '@adiwajshing/baileys';
import * as lodash from 'lodash';
import { parseVCardV3, SimpleVCardInfo } from '@waha/core/vcard';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mime = require('mime-types');

@Processor(QueueName.WAHA_MESSAGE_ANY, { concurrency: JOB_CONCURRENCY })
export class WAHAMessageAnyConsumer extends ChatWootWAHABaseConsumer {
  constructor(
    protected readonly manager: SessionManager,
    log: PinoLogger,
    rmutex: RMutexService,
  ) {
    super(manager, log, rmutex, 'WAHAMessageAnyConsumer');
  }

  GetChatId(event: WAHAWebhookMessageAny): string {
    return event.payload.from;
  }

  async Process(
    job: Job<EventData, any, WAHAEvents>,
    info: IMessageInfo,
  ): Promise<any> {
    const container = await this.DIContainer(job, job.data.app);
    const event: WAHAWebhookMessageAny = job.data.event as any;
    const session = new WAHASessionAPI(event.session, container.WAHASelf());
    const handler = new MessageAnyHandler(
      job,
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

function isEmptyString(content: string) {
  if (!content) {
    return true;
  }
  return content == '' || content == '\n';
}

class MessageAnyHandler extends MessageBaseHandler<WAMessage> {
  protected async getMessage(
    payload: WAMessage,
  ): Promise<ChatWootMessagePartial> {
    const protoMessage = this.getProtoMessage(payload);
    let msg = await this.getTextMessage(payload, protoMessage);
    if (msg) {
      return msg;
    }
    msg = this.getLocationMessage(payload, protoMessage);
    if (msg) {
      return msg;
    }
    msg = this.getShareContactMessage(payload, protoMessage);
    if (msg) {
      return msg;
    }
    return this.getUnsupportedMessage();
  }

  protected async getTextMessage(
    payload: WAMessage,
    _: proto.Message | null,
  ): Promise<ChatWootMessagePartial | null> {
    const attachments = await this.getAttachments(payload);
    let content = this.l
      .key(TKey.WA_TO_CW_MESSAGE)
      .render({ payload: payload });
    if (isEmptyString(content) && attachments.length == 0) {
      return null;
    }
    if (isEmptyString(content)) {
      content = null;
    }
    return {
      content: WhatsappToMarkdown(content),
      attachments: attachments,
      private: undefined,
    };
  }

  private getLocationMessage(
    payload: WAMessage,
    message: proto.Message | null,
  ): ChatWootMessagePartial | null {
    const hasLocation = !lodash.isEmpty(message?.locationMessage);
    const hasLiveLocation = !lodash.isEmpty(message?.liveLocationMessage);
    if (!hasLocation && !hasLiveLocation) {
      return null;
    }
    const location = this.l.key(TKey.WA_TO_CW_MESSAGE_LOCATION).r({
      payload,
      message,
    });
    if (isEmptyString(location)) {
      return null;
    }
    return {
      content: location,
      attachments: [],
      private: undefined,
    };
  }

  private getShareContactMessage(
    _payload: WAMessage,
    message: proto.Message | null,
  ): ChatWootMessagePartial | null {
    let vcards: string[] = [];

    if (!lodash.isEmpty(message?.contactsArrayMessage?.contacts)) {
      vcards = message!.contactsArrayMessage!.contacts.map((c) => c.vcard);
    } else if (!lodash.isEmpty(message?.contactMessage?.vcard)) {
      vcards = [message!.contactMessage!.vcard];
    }
    if (vcards.length === 0) {
      return null;
    }
    const attachments: SendAttachment[] = vcards.map((v, i) => ({
      content: Buffer.from(v, 'utf8').toString('base64'),
      encoding: 'base64',
      filename: `vcard-${i + 1}.vcf`,
    }));
    let contacts: SimpleVCardInfo[] = [];
    try {
      contacts = vcards.map(parseVCardV3);
    } catch (err) {
      this.logger.error(
        `Error parsing some vcards: vcards=${vcards}, err=${err}`,
      );
    }
    const msg = this.l.key(TKey.WA_TO_CW_MESSAGE_CONTACTS).r({ contacts });
    if (contacts.length === 0 && attachments.length === 0) {
      return null;
    }

    return {
      content: msg,
      attachments: attachments,
      private: undefined,
    };
  }

  private getUnsupportedMessage(): ChatWootMessagePartial {
    const unsupported = this.l
      .key(TKey.WA_TO_CW_MESSAGE_UNSUPPORTED)
      .render({ details: JobLink(this.job) });
    return {
      content: unsupported,
      attachments: [],
      private: true,
    };
  }

  private getProtoMessage(payload: WAMessage): proto.Message | null {
    // GOWS
    if (payload._data.Message) {
      return payload._data.Message;
    }
    // NOWEB
    if (payload._data.message) {
      return payload._data.message;
    }
    // WEBJS - not available
    return null;
  }

  getReplyToWhatsAppID(payload: WAMessage): string {
    const replyTo = payload.replyTo;
    if (!replyTo) {
      return undefined;
    }
    const key = parseMessageIdSerialized(replyTo.id, true);
    return key.id;
  }

  async getAttachments(payload: WAMessage): Promise<SendAttachment[]> {
    //
    // WAHA
    //
    const hasMedia = payload.media?.url;
    if (!hasMedia) {
      return [];
    }

    const attachments: SendAttachment[] = [];
    const media = payload.media;
    this.logger.info(`Downloading media from '${media.url}'...`);
    const buffer = await this.waha.fetch(media.url);
    const fileContent = buffer.toString('base64');
    let filename = media.filename;
    if (!filename) {
      const extension = mime.extension(media.mimetype);
      filename = `no-filename.${extension}`;
    }

    const attachment: SendAttachment = {
      content: fileContent,
      filename: filename,
      encoding: 'base64',
    };
    attachments.push(attachment);
    this.logger.info(`Downloaded media from '${media.url}' as '${filename}'`);
    return attachments;
  }
}
