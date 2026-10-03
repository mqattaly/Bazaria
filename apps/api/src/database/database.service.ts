import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, type QueryResult, type QueryResultRow } from 'pg';
import { PG_POOL } from './database.constants.js';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async query<Row extends QueryResultRow = QueryResultRow>(
    statement: string,
    values?: unknown[],
  ): Promise<QueryResult<Row>> {
    return this.pool.query<Row>(statement, values);
  }

  async ping(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
