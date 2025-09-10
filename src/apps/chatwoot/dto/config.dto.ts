import { ChatWootAPIConfig } from '@waha/apps/chatwoot/client/interfaces';
import { IsBoolean, IsNumber, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export const DEFAULT_LOCALE = 'en-US';

export class ChatWootCommandsConfig {
  @IsBoolean()
  server: boolean = true;
}

export interface ChatWootConfig {
  commands: ChatWootCommandsConfig;
}

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

  @ValidateNested()
  @Type(() => ChatWootCommandsConfig)
  commands?: ChatWootCommandsConfig;
}
