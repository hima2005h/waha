import { ISQLEngine } from '@waha/core/storage/sql/ISQLEngine';
import { Knex } from 'knex';

export class KnexEngine implements ISQLEngine {
  constructor(private knex: Knex) {}

  async run(query: Knex.QueryBuilder): Promise<void> {
    await query;
  }

  async get(query: Knex.QueryBuilder): Promise<any> {
    const result = await query.first();
    return result;
  }

  async all(query: Knex.QueryBuilder): Promise<any[]> {
    const result = await query;
    return result;
  }

  async raw(sql: string, bindings: any[]): Promise<void> {
    await this.knex.raw(sql, bindings);
  }

  async exec(sql: string): Promise<void> {
    await this.knex.raw(sql);
  }
}
