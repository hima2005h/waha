import { ChatWootAPIConfig } from '@waha/apps/chatwoot/client/interfaces';
import { IsNumber, IsString } from 'class-validator';

export const DEFAULT_LOCALE = 'en-US';

export class ChatWootAppConfig implements ChatWootAPIConfig {
  @IsString()
  url: string;

  @IsNumber()
  accountId: number;

  @IsString()
  accountToken: string;

  @IsNumber()
  inboxId: number;

  @IsString()
  inboxIdentifier: string;

  @IsString()
  locale: string = DEFAULT_LOCALE;
}
