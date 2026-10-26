import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { requireDatabaseUrl } from '../config/env';
import { currentClient } from '../common/request-context';

/**
 * PostgreSQL access. All queries participate in the request transaction when
 * one exists (see RequestTransactionInterceptor); otherwise the pool is used.
 */
@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseService.name);
  readonly pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: requireDatabaseUrl(),
      max: Number.parseInt(process.env.DATABASE_POOL_MAX ?? '10', 10),
    });
    this.pool.on('error', (error) => {
      this.logger.error(`Idle PostgreSQL client error: ${error.message}`);
    });
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> {
    const client = currentClient();
    if (client) {
      return client.query<T>(text, params);
    }
    return this.pool.query<T>(text, params);
  }

  async withTransaction<T>(
    fn: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
