import { ChatWootAPIConfig } from '@waha/apps/chatwoot/client/interfaces';
import { DEFAULT_LOCALE, LOCALES } from '@waha/apps/chatwoot/locale';
import { IsIn, IsNumber, IsString } from 'class-validator';

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
  @IsIn(LOCALES)
  locale: string = DEFAULT_LOCALE;
}
