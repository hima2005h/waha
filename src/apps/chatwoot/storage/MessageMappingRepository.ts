import { Knex } from 'knex';

import { ChatwootMessage, MessageMapping, WhatsAppMessage } from './types';

export class MessageMappingRepository {
  static tableName = 'app_chatwoot_message_mappings';

  constructor(
    private readonly knex: Knex,
    private readonly appPk: number,
  ) {}

  get tableName() {
    return MessageMappingRepository.tableName;
  }

  /**
   * Creates a mapping between a Chatwoot message and a WhatsApp message
   */
  upsertMapping(
    chatwoot: Pick<ChatwootMessage, 'id'>,
    whatsapp: Pick<WhatsAppMessage, 'id'>,
    part: number,
  ): Promise<MessageMapping> {
    return this.knex.transaction((trx) =>
      this.upsertMappingWithTrx(trx, chatwoot, whatsapp, part),
    );
  }

  async upsertMappingWithTrx(
    trx: Knex.Transaction,
    chatwoot: Pick<ChatwootMessage, 'id'>,
    whatsapp: Pick<WhatsAppMessage, 'id'>,
    part: number,
  ): Promise<MessageMapping> {
    const [id] = await trx(this.tableName)
      .insert({
        app_pk: this.appPk,
        chatwoot_message_id: chatwoot.id,
        whatsapp_message_id: whatsapp.id,
        part,
      })
      .onConflict([
        'app_pk',
        'chatwoot_message_id',
        'whatsapp_message_id',
        'part',
      ])
      .merge()
      .returning('id');

    return {
      id,
      chatwoot_message_id: chatwoot.id,
      whatsapp_message_id: whatsapp.id,
      part: part,
    };
  }

  async getByWhatsAppMessageId(id: number): Promise<MessageMapping | null> {
    return this.knex(this.tableName)
      .where({
        app_pk: this.appPk,
        whatsapp_message_id: id,
      })
      .first();
  }

  async getByChatwootMessageId(id: number): Promise<MessageMapping | null> {
    return this.knex(this.tableName)
      .where({
        app_pk: this.appPk,
        chatwoot_message_id: id,
      })
      .first();
  }
}
