import * as process from 'node:process';

import { INestApplication, MiddlewareConsumer, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { ServeStaticModule } from '@nestjs/serve-static';
import { TerminusModule } from '@nestjs/terminus';
import { ChannelsController } from '@waha/api/channels.controller';
import { LidsController } from '@waha/api/lids.controller';
import { ProfileController } from '@waha/api/profile.controller';
import {
  ServerController,
  ServerDebugController,
} from '@waha/api/server.controller';
import { WebsocketGatewayCore } from '@waha/core/api/websocket.gateway.core';
import { ApiKeyStrategy } from '@waha/core/auth/apiKey.strategy';
import { AuthMiddleware } from '@waha/core/auth/auth.middleware';
import { BasicAuthFunction } from '@waha/core/auth/basicAuth';
import { WebSocketAuth } from '@waha/core/auth/WebSocketAuth';
import { GowsEngineConfigService } from '@waha/core/config/GowsEngineConfigService';
import { WebJSEngineConfigService } from '@waha/core/config/WebJSEngineConfigService';
import { MediaLocalStorageModule } from '@waha/core/media/local/media.local.storage.module';
import { MediaLocalStorageConfig } from '@waha/core/media/local/MediaLocalStorageConfig';
import { ChannelsInfoServiceCore } from '@waha/core/services/ChannelsInfoServiceCore';
import { parseBool } from '@waha/helpers';
import { BufferJsonReplacerInterceptor } from '@waha/nestjs/BufferJsonReplacerInterceptor';
import { HttpsExpress } from '@waha/nestjs/HttpsExpress';
import {
  getPinoHttpUseLevel,
  getPinoLogLevel,
  getPinoTransport,
} from '@waha/utils/logging';
import { noSlashAtTheEnd } from '@waha/utils/string';
import * as Joi from 'joi';
import { LoggerModule } from 'nestjs-pino';
import { join } from 'path';
import { Logger } from 'pino';

import { AuthController } from '../api/auth.controller';
import { ChatsController } from '../api/chats.controller';
import { ChattingController } from '../api/chatting.controller';
import { ContactsController } from '../api/contacts.controller';
import { EventsController } from '../api/events.controller';
import { GroupsController } from '../api/groups.controller';
import { HealthController } from '../api/health.controller';
import { LabelsController } from '../api/labels.controller';
import { MediaController } from '../api/media.controller';
import { PingController } from '../api/ping.controller';
import { PresenceController } from '../api/presence.controller';
import { ScreenshotController } from '../api/screenshot.controller';
import { SessionsController } from '../api/sessions.controller';
import { StatusController } from '../api/status.controller';
import { VersionController } from '../api/version.controller';
import { WhatsappConfigService } from '../config.service';
import { SessionManager } from './abc/manager.abc';
import { WAHAHealthCheckService } from './abc/WAHAHealthCheckService';
import { DashboardConfigServiceCore } from './config/DashboardConfigServiceCore';
import { EngineConfigService } from './config/EngineConfigService';
import { SwaggerConfigServiceCore } from './config/SwaggerConfigServiceCore';
import { WAHAHealthCheckServiceCore } from './health/WAHAHealthCheckServiceCore';
import { SessionManagerCore } from './manager.core';

export const IMPORTS_CORE = [
  LoggerModule.forRoot({
    renameContext: 'name',
    pinoHttp: {
      quietReqLogger: true,
      level: getPinoLogLevel(),
      useLevel: getPinoHttpUseLevel(),
      transport: getPinoTransport(),
      autoLogging: {
        ignore: (req) => {
          return (
            req.url.startsWith('/dashboard/') ||
            req.url.startsWith('/api/files/') ||
            req.url.startsWith('/api/s3/')
          );
        },
      },
      serializers: {
        req: (req) => ({
          id: req.id,
          method: req.method,
          url: req.url,
          query: req.query,
          params: req.params,
        }),
        res: (res) => ({
          statusCode: res.statusCode,
        }),
      },
    },
  }),
  ConfigModule.forRoot({
    isGlobal: true,
    validationSchema: Joi.object({
      WHATSAPP_API_SCHEMA: Joi.string().valid('http', 'https').default('http'),
    }),
  }),
  ServeStaticModule.forRootAsync({
    imports: [],
    extraProviders: [DashboardConfigServiceCore],
    inject: [DashboardConfigServiceCore],
    useFactory: (dashboardConfig: DashboardConfigServiceCore) => {
      if (!dashboardConfig.enabled) {
        return [];
      }
      return [
        {
          rootPath: join(__dirname, '..', 'dashboard'),
          serveRoot: dashboardConfig.dashboardUri,
        },
      ];
    },
  }),
  PassportModule,
  TerminusModule,
];

const IMPORTS_MEDIA = [
  ConfigModule.forRoot({
    validationSchema: Joi.object({
      WAHA_MEDIA_STORAGE: Joi.string()
        .valid('LOCAL', 'S3', 'POSTGRESQL')
        .default('LOCAL'),
    }),
  }),
  MediaLocalStorageModule,
];

const IMPORTS = [...IMPORTS_CORE, ...IMPORTS_MEDIA];

export const CONTROLLERS = [
  AuthController,
  SessionsController,
  ProfileController,
  ChattingController,
  ChatsController,
  ChannelsController,
  StatusController,
  LabelsController,
  ContactsController,
  LidsController,
  GroupsController,
  PresenceController,
  ScreenshotController,
  EventsController,
  PingController,
  HealthController,
  ServerController,
  ServerDebugController,
  VersionController,
  MediaController,
];
export const PROVIDERS_BASE = [
  {
    provide: APP_INTERCEPTOR,
    useClass: BufferJsonReplacerInterceptor,
  },
  DashboardConfigServiceCore,
  SwaggerConfigServiceCore,
  WebJSEngineConfigService,
  GowsEngineConfigService,
  WhatsappConfigService,
  EngineConfigService,
  WebsocketGatewayCore,
  MediaLocalStorageConfig,
  WebSocketAuth,
  ApiKeyStrategy,
];

const PROVIDERS = [
  {
    provide: SessionManager,
    useClass: SessionManagerCore,
  },
  {
    provide: WAHAHealthCheckService,
    useClass: WAHAHealthCheckServiceCore,
  },
  ChannelsInfoServiceCore,
  ...PROVIDERS_BASE,
];

@Module({
  imports: IMPORTS,
  controllers: CONTROLLERS,
  providers: PROVIDERS,
})
export class AppModuleCore {
  public startTimestamp: number;

  constructor(
    protected config: WhatsappConfigService,
    private dashboardConfig: DashboardConfigServiceCore,
  ) {
    this.startTimestamp = Date.now();
  }

  static getHttpsOptions(logger: Logger) {
    const httpsEnabled = parseBool(process.env.WAHA_HTTPS_ENABLED);
    if (!httpsEnabled) {
      return undefined;
    }
    const httpsExpress = new HttpsExpress(logger);
    return httpsExpress.readSync();
  }

  static appReady(app: INestApplication, logger: Logger) {
    const httpsEnabled = parseBool(process.env.WAHA_HTTPS_ENABLED);
    if (!httpsEnabled) {
      return;
    }
    const httpd = app.getHttpServer();
    const httpsExpress = new HttpsExpress(logger);
    httpsExpress.watchCertChanges(httpd);
  }

  configure(consumer: MiddlewareConsumer) {
    const exclude = this.config.getExcludedPaths();
    consumer
      .apply(AuthMiddleware)
      .exclude(...exclude)
      .forRoutes('api', 'health', 'ws');
    const dashboardCredentials = this.dashboardConfig.credentials;
    if (dashboardCredentials) {
      const username = dashboardCredentials[0];
      const password = dashboardCredentials[1];
      const route = noSlashAtTheEnd(this.dashboardConfig.dashboardUri);
      consumer.apply(BasicAuthFunction(username, password)).forRoutes(route);
    }
  }
}
