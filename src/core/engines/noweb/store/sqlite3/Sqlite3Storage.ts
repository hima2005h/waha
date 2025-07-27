import { ILabelAssociationRepository } from '@waha/core/engines/noweb/store/ILabelAssociationsRepository';
import { ILabelsRepository } from '@waha/core/engines/noweb/store/ILabelsRepository';
import { INowebLidPNRepository } from '@waha/core/engines/noweb/store/INowebLidPNRepository';
import { Sqlite3GroupRepository } from '@waha/core/engines/noweb/store/sqlite3/Sqlite3GroupRepository';
import { Sqlite3LabelAssociationsRepository } from '@waha/core/engines/noweb/store/sqlite3/Sqlite3LabelAssociationsRepository';
import { Sqlite3LabelsRepository } from '@waha/core/engines/noweb/store/sqlite3/Sqlite3LabelsRepository';
import { Sqlite3LidPNRepository } from '@waha/core/engines/noweb/store/sqlite3/Sqlite3LidPNRepository';
import { Schema } from '@waha/core/storage/Schema';
import Knex from 'knex';

import { INowebStorage } from '../INowebStorage';
import { Migrations, NOWEB_STORE_SCHEMA } from '../schemas';
import { Sqlite3ChatRepository } from './Sqlite3ChatRepository';
import { Sqlite3ContactRepository } from './Sqlite3ContactRepository';
import { Sqlite3MessagesRepository } from './Sqlite3MessagesRepository';
import { Sqlite3SchemaValidation } from './Sqlite3SchemaValidation';

export class Sqlite3Storage extends INowebStorage {
  private readonly tables: Schema[];
  private readonly knex: Knex.Knex;

  constructor(filePath: string) {
    super();
    this.knex = Knex({
      client: 'sqlite3',
      connection: { filename: filePath },
      useNullAsDefault: true,
    });
    this.tables = NOWEB_STORE_SCHEMA;
  }

  async init() {
    await this.knex.raw('PRAGMA journal_mode = WAL;');
    await this.migrate();
    await this.validateSchema();
  }

  private async migrate() {
    await this.migration0001init();
  }

  private async validateSchema() {
    for (const table of this.tables) {
      await new Sqlite3SchemaValidation(table, this.knex).validate();
    }
  }

  private async migration0001init() {
    for (const migration of Migrations) {
      await this.knex.raw(migration);
    }
  }

  async close() {
    return this.knex.destroy();
  }

  getContactsRepository() {
    return new Sqlite3ContactRepository(this.knex);
  }

  getChatRepository() {
    return new Sqlite3ChatRepository(this.knex);
  }

  getGroupRepository() {
    return new Sqlite3GroupRepository(this.knex);
  }

  getLabelsRepository(): ILabelsRepository {
    return new Sqlite3LabelsRepository(this.knex);
  }

  getLabelAssociationRepository(): ILabelAssociationRepository {
    return new Sqlite3LabelAssociationsRepository(this.knex);
  }

  getMessagesRepository() {
    return new Sqlite3MessagesRepository(this.knex);
  }

  getLidPNRepository(): INowebLidPNRepository {
    return new Sqlite3LidPNRepository(this.knex);
  }
}
