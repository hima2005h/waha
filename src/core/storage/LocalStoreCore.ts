import { safeJoin } from '@waha/utils/files';
import * as fs from 'fs/promises';
import * as path from 'path';

import { LocalStore } from './LocalStore';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Database = require('better-sqlite3');

export class LocalStoreCore extends LocalStore {
  protected readonly baseDirectory: string =
    process.env.WAHA_LOCAL_STORE_BASE_DIR || './.sessions';

  private readonly engine: string;
  private db: any;

  constructor(engine: string) {
    super();
    this.engine = engine;
  }

  async init(sessionName?: string) {
    await fs.mkdir(this.getEngineDirectory(), { recursive: true });
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

  getWAHADatabase(): any {
    if (!this.db) {
      const engineDir = this.getEngineDirectory();
      const database = safeJoin(engineDir, 'waha.sqlite3');
      this.db = new Database(database);
      this.db.pragma('journal_mode = WAL;');
    }
    return this.db;
  }

  async close() {
    this.db?.close();
  }
}
