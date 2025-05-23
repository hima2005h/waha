import { ILabelAssociationRepository } from '@waha/core/engines/noweb/store/ILabelAssociationsRepository';
import { ILabelsRepository } from '@waha/core/engines/noweb/store/ILabelsRepository';
import { INowebLidPNRepository } from '@waha/core/engines/noweb/store/INowebLidPNRepository';
import { Sqlite3GroupRepository } from '@waha/core/engines/noweb/store/sqlite3/Sqlite3GroupRepository';
import { Sqlite3LabelAssociationsRepository } from '@waha/core/engines/noweb/store/sqlite3/Sqlite3LabelAssociationsRepository';
import { Sqlite3LabelsRepository } from '@waha/core/engines/noweb/store/sqlite3/Sqlite3LabelsRepository';
import { Sqlite3LidPNRepository } from '@waha/core/engines/noweb/store/sqlite3/Sqlite3LidPNRepository';
import { Schema } from '@waha/core/storage/Schema';

import { INowebStorage } from '../INowebStorage';
import { Migrations, NOWEB_STORE_SCHEMA } from '../schemas';
import { Sqlite3ChatRepository } from './Sqlite3ChatRepository';
import { Sqlite3ContactRepository } from './Sqlite3ContactRepository';
import { Sqlite3MessagesRepository } from './Sqlite3MessagesRepository';
import { Sqlite3SchemaValidation } from './Sqlite3SchemaValidation';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Database = require('better-sqlite3');

export class Sqlite3Storage extends INowebStorage {
  private readonly db: any;
  private readonly tables: Schema[];

  constructor(filePath: string) {
    super();
    this.db = new Database(filePath);
    this.tables = NOWEB_STORE_SCHEMA;
  }

  async init() {
    this.db.pragma('journal_mode = WAL;');
    this.migrate();
    this.validateSchema();
  }

  private migrate() {
    this.migration0001init();
  }

  private validateSchema() {
    for (const table of this.tables) {
      new Sqlite3SchemaValidation(table, this.db).validate();
    }
  }

  private migration0001init() {
    for (const migration of Migrations) {
      this.db.exec(migration);
    }
  }

  async close() {
    return this.db.close();
  }

  getContactsRepository() {
    return new Sqlite3ContactRepository(this.db);
  }

  getChatRepository() {
    return new Sqlite3ChatRepository(this.db);
  }

  getGroupRepository() {
    return new Sqlite3GroupRepository(this.db);
  }

  getLabelsRepository(): ILabelsRepository {
    return new Sqlite3LabelsRepository(this.db);
  }

  getLabelAssociationRepository(): ILabelAssociationRepository {
    return new Sqlite3LabelAssociationsRepository(this.db);
  }

  getMessagesRepository() {
    return new Sqlite3MessagesRepository(this.db);
  }

  getLidPNRepository(): INowebLidPNRepository {
    return new Sqlite3LidPNRepository(this.db);
  }
}
