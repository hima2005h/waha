import { Processor } from '@nestjs/bullmq';
import { JOB_CONCURRENCY } from '@waha/apps/app_sdk/constants';
import { ILogger } from '@waha/apps/app_sdk/ILogger';
import { MessageAttachment } from '@waha/apps/chatwoot/client/types';
import {
  ChatWootInboxMessageConsumer,
  LookupAndCheckChatId,
} from '@waha/apps/chatwoot/consumers/inbox/base';
import { QueueName } from '@waha/apps/chatwoot/consumers/QueueName';
import { DIContainer } from '@waha/apps/chatwoot/di/DIContainer';
import { TKey } from '@waha/apps/chatwoot/locale';
import { EngineHelper } from '@waha/apps/chatwoot/session';
import { WAHASessionAPI } from '@waha/apps/chatwoot/session/WAHASelf';
import {
  ChatwootMessage,
  MessageMappingService,
} from '@waha/apps/chatwoot/storage';
import { MarkdownToWhatsApp } from '@waha/apps/chatwoot/text';
import { SessionManager } from '@waha/core/abc/manager.abc';
import { RMutexService } from '@waha/modules/rmutex/rmutex.service';
import {
  MessageFileRequest,
  MessageImageRequest,
  MessageTextRequest,
  MessageVideoRequest,
  MessageVoiceRequest,
} from '@waha/structures/chatting.dto';
import { sleep } from '@waha/utils/promiseTimeout';
import { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';

import { SerializeWhatsAppKey } from '../../client/ids';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mime = require('mime-types');

@Processor(QueueName.INBOX_MESSAGE_CREATED, { concurrency: JOB_CONCURRENCY })
export class ChatWootInboxMessageCreatedConsumer extends ChatWootInboxMessageConsumer {
  constructor(
    protected readonly manager: SessionManager,
    log: PinoLogger,
    rmutex: RMutexService,
  ) {
    super(manager, log, rmutex, 'ChatWootInboxMessageCreatedConsumer');
  }

  ErrorHeaderKey(): TKey | null {
    return TKey.WHATSAPP_ERROR_SENDING_MESSAGE;
  }

  protected async Process(container: DIContainer, body, job: Job) {
    const waha = container.WAHASelf();
    const session = new WAHASessionAPI(job.data.session, waha);
    const handler = new MessageHandler(
      container.MessageMappingService(),
      container.Logger(),
      session,
    );
    return await handler.handle(body);
  }
}

export class MessageHandler {
  constructor(
    private mappingService: MessageMappingService,
    private logger: ILogger,
    private session: WAHASessionAPI,
  ) {}

  async handle(body: any) {
    const chatId = await LookupAndCheckChatId(this.session, body);
    const message = body;
    if (message.content_type != 'text') {
      this.logger.info(
        `Message content type not supported. Content type: ${message.content_type}`,
      );
      return;
    }

    const content = MarkdownToWhatsApp(message.content);
    const attachments = message.attachments || [];
    const results = [];
    const multipleAttachments = attachments.length > 1;
    let part = 1;
    const replyTo = await this.getReplyTo(message).catch((err) => {
      this.logger.error(`Error getting reply to message ID: ${err}`);
      return undefined;
    });

    // Send text
    if (attachments.length == 0 || multipleAttachments) {
      const msg = await this.sendTextMessage(chatId, content, replyTo);
      results.push(msg);
      part = await this.saveMapping(message, msg, part);
      this.logger.info(`Text message sent: ${msg.id}`);
    }

    // Send files
    const fileMessageContent = multipleAttachments ? '' : content;
    for (const file of attachments) {
      const msg = await this.sendFile(
        chatId,
        fileMessageContent,
        file,
        replyTo,
      );
      this.logger.info(
        `File message sent: ${msg.id} - ${file.data_url} - ${file.file_type}`,
      );
      results.push(msg);
      part = await this.saveMapping(message, msg, part);
    }
    return results;
  }

  private async saveMapping(
    chatwootMessage: any,
    whatsappMessage: any,
    part: number,
  ): Promise<number> {
    const chatwoot: Omit<ChatwootMessage, 'id'> = {
      timestamp: new Date(chatwootMessage.created_at),
      conversation_id: chatwootMessage.conversation.id,
      message_id: chatwootMessage.id,
    };
    const whatsapp = EngineHelper.WhatsAppMessageKeys(whatsappMessage);
    await this.mappingService.map(chatwoot, whatsapp, 1);
    return part + 1;
  }

  async getReplyTo(message): Promise<string | undefined> {
    const message_id = message.content_attributes.in_reply_to;
    if (!message_id) {
      return;
    }
    const messages = await this.mappingService.getWhatsAppMessage({
      conversation_id: message.conversation.id,
      message_id: message_id,
    });
    if (!messages || messages.length == 0) {
      return;
    }
    const whatsapp = messages[0];
    return SerializeWhatsAppKey(whatsapp);
  }

  private async sendTextMessage(
    chatId: string,
    content: string,
    replyTo: string,
  ) {
    const request: MessageTextRequest = {
      session: '',
      chatId: chatId,
      text: content,
      reply_to: replyTo,
    };
    const session = this.session;
    await session.readMessages(chatId);
    await session.startTyping({ chatId: chatId, session: '' });
    await sleep(2000);
    await session.stopTyping({ chatId: chatId, session: '' });
    const msg = await session.sendText(request);
    return msg;
  }

  private async sendFile(
    chatId: string,
    content: string,
    file: MessageAttachment,
    replyTo: string,
  ) {
    const url = file.data_url;
    let filename = url.split('/').pop();
    if (filename) {
      filename = decodeURIComponent(filename);
    }
    const mimetype = mime.lookup(filename);
    const session = this.session;

    switch (file.file_type) {
      case 'image':
        if (mimetype != 'image/jpeg' && mimetype != 'image/png') {
          // Send it as a file
          break;
        }
        const imageRequest: MessageImageRequest = {
          session: '',
          caption: content,
          chatId: chatId,
          reply_to: replyTo,
          file: {
            url: url,
            mimetype: mimetype,
          },
        };
        return session.sendImage(imageRequest);
      case 'video':
        if (mimetype != 'video/mp4') {
          break;
        }
        const videoRequest: MessageVideoRequest = {
          session: '',
          caption: content,
          chatId: chatId,
          reply_to: replyTo,
          file: {
            url: url,
            mimetype: mimetype,
            filename: filename,
          },
          convert: true,
        };
        return session.sendVideo(videoRequest);
      case 'audio':
        const voiceRequest: MessageVoiceRequest = {
          session: '',
          chatId: chatId,
          file: {
            url: url,
            mimetype: mimetype,
            filename: filename,
          },
          convert: true,
        };
        return session.sendVoice(voiceRequest);
    }
    // Fallback and send as file (attachment)
    const fileRequest: MessageFileRequest = {
      session: '',
      caption: content,
      chatId: chatId,
      reply_to: replyTo,
      file: {
        filename: filename,
        url: url,
        mimetype: mimetype,
      },
    };
    return session.sendFile(fileRequest);
  }
}
