import { App } from '@waha/apps/app_sdk/dto/app.dto';
import { WhatsappSession } from '@waha/core/abc/session.abc';

/**
 * Exact App service
 */
export interface IAppService {
  beforeCreated(app: App): Promise<void>;

  beforeUpdated(savedApp: App, newApp: App): Promise<void>;

  beforeDeleted(app: App): Promise<void>;

  beforeSessionStart(app: App, session: WhatsappSession): Promise<void>;
}
