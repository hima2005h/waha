export enum QueueName {
  //
  // Scheduled
  //
  SCHEDULED_MESSAGE_CLEANUP = 'chatwoot.scheduled | message.cleanup',
  SCHEDULED_CHECK_VERSION = 'chatwoot.scheduled | check.version',

  //
  // WAHA Events
  //
  WAHA_SESSION_STATUS = 'chatwoot.waha | session.status',
  WAHA_MESSAGE_ANY = 'chatwoot.waha | message.any',
  WAHA_MESSAGE_REACTION = 'chatwoot.waha | message.reaction',
  WAHA_MESSAGE_EDITED = 'chatwoot.waha | message.edited',
  WAHA_MESSAGE_REVOKED = 'chatwoot.waha | message.revoked',
  //
  // ChatWoot Events - Real
  //
  INBOX_MESSAGE_CREATED = 'chatwoot.inbox | message_created',
  INBOX_MESSAGE_UPDATED = 'chatwoot.inbox | message_updated',
  //
  // ChatWoot Events - Artificial
  //
  INBOX_MESSAGE_DELETED = 'chatwoot.inbox | message_deleted',
  INBOX_COMMANDS = 'chatwoot.inbox | commands',
}
