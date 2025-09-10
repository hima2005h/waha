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
import { IsDynamicObject } from '@waha/nestjs/validation/IsDynamicObject';

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
  templates: Record<string, string>;
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

  @IsOptional()
  @IsDynamicObject()
  templates?: Record<string, string>;

  @ValidateNested()
  @Type(() => ChatWootCommandsConfig)
  commands?: ChatWootCommandsConfig;
}
