import { App } from '@waha/apps/app_sdk/dto/app.dto';
import { DataStore } from '@waha/core/abc/DataStore';
import { SessionManager } from '@waha/core/abc/manager.abc';
import { WhatsappSession } from '@waha/core/abc/session.abc';
import { Knex } from 'knex';

export interface IAppsService {
  list(manager: SessionManager, session: string): Promise<App[]>;

  create(manager: SessionManager, app: App): Promise<App>;

  update(manager: SessionManager, app: App): Promise<void>;

  delete(manager: SessionManager, appId: string): Promise<void>;

  beforeSessionStart(session: WhatsappSession, store: DataStore): Promise<void>;

  migrate(knex: Knex): Promise<void>;
}

export const AppsService = Symbol('AppsService');
