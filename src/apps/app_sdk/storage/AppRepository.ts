import { Knex } from 'knex';

import { App } from '../dto/app.dto';
import { AppDB } from './types';

export class AppRepository {
  static tableName = 'apps';

  constructor(private readonly knex: Knex) {}

  get tableName() {
    return AppRepository.tableName;
  }

  /**
   * Saves an app to the database
   */
  async save(app: Omit<App, 'pk'>): Promise<AppDB> {
    const appToSave = { ...app };
    if (appToSave.config && typeof appToSave.config === 'object') {
      appToSave.config = JSON.stringify(appToSave.config);
    }
    const [pk] = await this.knex(this.tableName)
      .insert(appToSave)
      .returning('pk');
    return { ...app, pk: pk };
  }

  private deserialize(app: AppDB): AppDB {
    const parsedConfig =
      typeof app.config === 'string' ? JSON.parse(app.config) : app.config;
    return { ...app, config: parsedConfig };
  }

  private serialize<T extends Partial<App>>(app: T): T {
    const appCopy = { ...app };
    if (appCopy.config && typeof appCopy.config === 'object') {
      appCopy.config = JSON.stringify(appCopy.config);
    }
    return appCopy;
  }

  /**
   * Gets an app by its id
   */
  async getById(id: string): Promise<AppDB | null> {
    const app = await this.knex(this.tableName).where('id', id).first();
    if (!app) {
      return null;
    }
    return this.deserialize(app);
  }

  /**
   * Gets all apps
   */
  async getAllBySession(session: string): Promise<AppDB[]> {
    return this.knex(this.tableName)
      .select('*')
      .where('session', session)
      .orderBy('id', 'asc')
      .then((apps) => apps.map((app) => this.deserialize(app)));
  }

  /**
   * Updates an app
   */
  async update(id: string, app: Partial<Omit<App, 'id'>>): Promise<void> {
    const appToUpdate = this.serialize(app);
    await this.knex(this.tableName).where('id', id).update(appToUpdate);
  }

  /**
   * Deletes an app
   */
  async delete(id: string): Promise<void> {
    await this.knex(this.tableName).where('id', id).delete();
  }
}
