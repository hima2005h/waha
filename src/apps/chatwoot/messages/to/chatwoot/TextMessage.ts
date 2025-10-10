import { ILogger } from '@waha/apps/app_sdk/ILogger';
import { SendAttachment } from '@waha/apps/chatwoot/client/types';
import { ChatWootMessagePartial } from '@waha/apps/chatwoot/consumers/waha/base';
import { Locale } from '@waha/apps/chatwoot/i18n/locale';
import { TKey } from '@waha/apps/chatwoot/i18n/templates';
import { WAHASelf } from '@waha/apps/chatwoot/session/WAHASelf';
import { isEmptyString } from './utils/proto';
import type { proto } from '@adiwajshing/baileys';
import { WAMessage } from '@waha/structures/responses.dto';
import { MessageToChatWootConverter } from '@waha/apps/chatwoot/messages/to/chatwoot';
import { WhatsappToMarkdown } from '@waha/apps/chatwoot/messages/to/chatwoot/utils/markdown';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mime = require('mime-types');

export class TextMessage implements MessageToChatWootConverter {
  constructor(
    private readonly locale: Locale,
    private readonly logger: ILogger,
    private readonly waha: WAHASelf,
  ) {}

  async convert(
    payload: WAMessage,
    protoMessage: proto.Message | null,
  ): Promise<ChatWootMessagePartial | null> {
    void protoMessage;
    const attachments = await this.getAttachments(payload);
    let content = this.locale.key(TKey.WA_TO_CW_MESSAGE).render({ payload });
    if (isEmptyString(content) && attachments.length === 0) {
      return null;
    }
    if (isEmptyString(content)) {
      content = null;
    }
    return {
      content: WhatsappToMarkdown(content),
      attachments,
      private: undefined,
    };
  }

  private async getAttachments(payload: WAMessage): Promise<SendAttachment[]> {
    const hasMedia = payload.media?.url;
    if (!hasMedia) {
      return [];
    }

    const media = payload.media!;
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
      filename,
      encoding: 'base64',
    };
    this.logger.info(`Downloaded media from '${media.url}' as '${filename}'`);
    return [attachment];
  }
}
