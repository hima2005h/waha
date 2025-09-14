import { ChatWootCommandsConfig } from '@waha/apps/chatwoot/dto/config.dto';

export enum TKey {
  LOCALE_NAME = 'locale.name',

  //
  // Jobs
  //
  JOB_REPORT_ERROR = 'job.report.error',
  JOB_REPORT_SUCCEEDED = 'job.report.succeeded',
  JOB_SCHEDULED_ERROR_HEADER = 'job.scheduled.error.header',

  //
  // WhatsApp Message Status
  //
  WHATSAPP_MESSAGE_SENDING_ERROR = 'whatsapp.message.sending.error',
  WHATSAPP_MESSAGE_RECEIVING_ERROR = 'whatsapp.message.receiving.error',
  WHATSAPP_MESSAGE_REMOVING_ERROR = 'whatsapp.message.removing.error',

  //
  // WhatsApp Messages
  //
  MESSAGE_FROM_WHATSAPP = 'message.from.whatsapp',
  MESSAGE_FROM_API = 'message.from.api',
  MESSAGE_REMOVED_IN_WHATSAPP = 'message.removed.in.whatsapp',
  MESSAGE_EDITED_IN_WHATSAPP = 'message.edited.in.whatsapp',
  WHATSAPP_GROUP_MESSAGE = 'whatsapp.group.message',
  WHATSAPP_REACTION_ADDED = 'whatsapp.reaction.added',
  WHATSAPP_REACTION_REMOVED = 'whatsapp.reaction.removed',

  //
  // Contact Suffixes
  //
  WHATSAPP_CONTACT_GROUP_SUFFIX = 'whatsapp.contact.group.suffix',
  WHATSAPP_CONTACT_CHANNEL_SUFFIX = 'whatsapp.contact.channel.suffix',
  WHATSAPP_CONTACT_STATUS_NAME = 'whatsapp.contact.status.name',

  //
  // App Inbox
  //
  APP_INBOX_CONTACT_NAME = 'app.inbox.contact.name',
  APP_INBOX_CONTACT_AVATAR_URL = 'app.inbox.contact.avatar.url',

  //
  // App Status
  //
  APP_CONNECTED_MESSAGE = 'app.connected.message',
  APP_DISCONNECTED_MESSAGE = 'app.disconnected.message',
  APP_UPDATED_MESSAGE = 'app.updated.message',

  //
  // App Session Status
  //
  APP_SESSION_STATUS_CHANGE = 'app.session.status.change',
  APP_SESSION_CURRENT_STATUS = 'app.session.current.status',
  APP_SESSION_STATUS_WORKING = 'app.session.status.working',
  APP_SESSION_STATUS_ERROR = 'app.session.status.error',
  APP_SESSION_SCAN_QR_CODE = 'app.session.scan.qr.code',

  //
  // App Commands
  //
  APP_COMMANDS_LIST = 'app.commands.list',
  APP_COMMANDS_SERVER_DISABLED = 'app.commands.server.disabled',
  APP_HELP_REMINDER = 'app.help.reminder',
  APP_SERVER_VERSION_AND_STATUS = 'app.server.version.and.status',
  APP_SERVER_REBOOT = 'app.server.reboot',
  APP_SERVER_REBOOT_FORCE = 'app.server.reboot.force',
  APP_LOGOUT_SUCCESS = 'app.logout.success',

  //
  // App Inbox
  //
  WAHA_NEW_VERSION_AVAILABLE = 'waha.new.version.available',
  WAHA_CORE_VERSION_USED = 'waha.core.version.used',
}

// Define payload types
interface Link {
  text: string;
  url: string;
}

export type TemplatePayloads = {
  [TKey.LOCALE_NAME]: void;
  [TKey.APP_INBOX_CONTACT_NAME]: void;
  [TKey.APP_INBOX_CONTACT_AVATAR_URL]: void;
  [TKey.MESSAGE_FROM_WHATSAPP]: { text: string };
  [TKey.MESSAGE_FROM_API]: { text: string };
  [TKey.MESSAGE_REMOVED_IN_WHATSAPP]: void;
  [TKey.MESSAGE_EDITED_IN_WHATSAPP]: { text: string };
  [TKey.WHATSAPP_GROUP_MESSAGE]: { text: string; participant: string };
  [TKey.WHATSAPP_REACTION_ADDED]: { emoji: string };
  [TKey.WHATSAPP_REACTION_REMOVED]: void;
  [TKey.WHATSAPP_MESSAGE_SENDING_ERROR]: void;
  [TKey.WHATSAPP_MESSAGE_RECEIVING_ERROR]: void;
  [TKey.WHATSAPP_MESSAGE_REMOVING_ERROR]: void;
  [TKey.WHATSAPP_CONTACT_GROUP_SUFFIX]: void;
  [TKey.WHATSAPP_CONTACT_CHANNEL_SUFFIX]: void;
  [TKey.WHATSAPP_CONTACT_STATUS_NAME]: void;
  [TKey.JOB_SCHEDULED_ERROR_HEADER]: void;
  [TKey.JOB_REPORT_ERROR]: {
    header: string;
    error: string;
    details: Link;
    attempts: {
      current: number;
      max: number;
      nextDelay?: number;
    };
  };
  [TKey.JOB_REPORT_SUCCEEDED]: {
    details: Link;
    attempts: {
      current: number;
      max: number;
    };
  };
  [TKey.APP_CONNECTED_MESSAGE]: { name: string };
  [TKey.APP_DISCONNECTED_MESSAGE]: { name: string };
  [TKey.APP_UPDATED_MESSAGE]: { name: string };
  [TKey.APP_SESSION_STATUS_CHANGE]: {
    emoji: string;
    session: string;
    status: string;
  };
  [TKey.APP_SESSION_CURRENT_STATUS]: {
    emoji: string;
    session: string;
    status: string;
    name: string;
    id: string;
  };
  [TKey.APP_SESSION_STATUS_WORKING]: { name: string; id: string };
  [TKey.APP_SESSION_STATUS_ERROR]: void;
  [TKey.APP_SESSION_SCAN_QR_CODE]: void;
  [TKey.APP_HELP_REMINDER]: void;
  [TKey.APP_COMMANDS_LIST]: { commands: ChatWootCommandsConfig };
  [TKey.APP_COMMANDS_SERVER_DISABLED]: void;
  [TKey.APP_SERVER_VERSION_AND_STATUS]: {
    version: string;
    status: string;
  };
  [TKey.APP_SERVER_REBOOT]: void;
  [TKey.APP_SERVER_REBOOT_FORCE]: void;
  [TKey.APP_LOGOUT_SUCCESS]: void;
  [TKey.WAHA_NEW_VERSION_AVAILABLE]: {
    currentVersion: string;
    newVersion: string;
    changelogUrl: string;
  };
  [TKey.WAHA_CORE_VERSION_USED]: {
    supportUrl: string;
  };
};
