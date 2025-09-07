import { ChatWootAppConfig } from '@waha/apps/chatwoot/dto/config.dto';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export type AllowedAppConfig = ChatWootAppConfig;

export enum AppName {
  chatwoot = 'chatwoot',
}

export class App<T extends AllowedAppConfig = any> {
  @IsString()
  id: string;

  @IsString()
  session: string;

  // App name (aka type)
  @IsEnum(AppName)
  app: AppName;

  @ApiProperty({
    description:
      'Enable or disable this app without deleting it. If omitted, treated as enabled (true).',
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean = true;

  @ValidateNested()
  @Type((options) => {
    if (options && options.object && options.object.app) {
      switch (options.object.app) {
        case AppName.chatwoot:
          return ChatWootAppConfig;
        default:
          return Object;
      }
    }
    return Object;
  })
  config: T;
}

export class ChatWootAppDto extends App<ChatWootAppConfig> {
  @Type(() => ChatWootAppConfig)
  config: ChatWootAppConfig;
}

export type AppDto = ChatWootAppDto;
