import { safeJoin } from '@waha/utils/files';
import * as fs from 'fs/promises';
import Knex from 'knex';
import * as path from 'path';

import { LocalStore } from './LocalStore';

export class LocalStoreCore extends LocalStore {
  protected readonly baseDirectory: string =
    process.env.WAHA_LOCAL_STORE_BASE_DIR || './.sessions';

  private readonly engine: string;
  private knex: Knex.Knex;

  constructor(engine: string) {
    super();
    this.engine = engine;
  }

  async init(sessionName?: string) {
    await fs.mkdir(this.getEngineDirectory(), { recursive: true });
    if (!this.knex) {
      this.knex = this.buildKnex();
      await this.knex.raw('PRAGMA journal_mode = WAL;');
      await this.knex.raw('PRAGMA foreign_keys = ON;');
    }
    if (sessionName) {
      await fs.mkdir(this.getSessionDirectory(sessionName), {
        recursive: true,
      });
    }
  }

  /**
   * Get the directory where all the engines and sessions are stored
   */
  getBaseDirectory() {
    return path.resolve(this.baseDirectory);
  }

  /**
   * Get the directory where the engine sessions are stored
   */
  getEngineDirectory() {
    return safeJoin(this.baseDirectory, this.engine);
  }

  getSessionDirectory(name: string): string {
    return this.getDirectoryPath(name);
  }

  getFilePath(session: string, file: string): string {
    return safeJoin(this.getSessionDirectory(session), file);
  }

  protected getDirectoryPath(name: string): string {
    return safeJoin(this.getEngineDirectory(), name);
  }

  getWAHADatabase(): Knex.Knex {
    if (!this.knex) {
      throw new Error('Knex is not initialized, call LocalStore.init() first');
    }
    return this.knex;
  }

  buildKnex(): Knex.Knex {
    const engineDir = this.getEngineDirectory();
    const database = path.join(engineDir, 'waha.sqlite3');
    return Knex({
      client: 'sqlite3',
      connection: { filename: database },
      useNullAsDefault: true,
    });
  }

  async close() {
    await this.knex.destroy();
  }
}
