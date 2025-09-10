import { ChatWootAPIConfig } from '@waha/apps/chatwoot/client/interfaces';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export const DEFAULT_LOCALE = 'en-US';

export class ChatWootCommandsConfig {
  @IsBoolean()
  server: boolean = true;
}

export enum LinkPreview {
  OFF = 'OFF',
  LQ = 'LG',
  HQ = 'HG',
}

export interface ChatWootConfig {
  linkPreview: LinkPreview;
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

  @IsEnum(LinkPreview)
  @IsOptional()
  linkPreview?: LinkPreview = LinkPreview.OFF;

  @IsString()
  locale: string = DEFAULT_LOCALE;

  @ValidateNested()
  @Type(() => ChatWootCommandsConfig)
  commands?: ChatWootCommandsConfig;
}
