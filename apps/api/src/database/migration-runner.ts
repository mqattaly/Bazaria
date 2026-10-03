import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Pool } from 'pg';

const MIGRATION_LOCK_KEY = 760_481;
const MIGRATION_FILENAME = /^\d{4}_[a-z0-9_]+\.sql$/;

export interface MigrationRunResult {
  applied: string[];
  alreadyApplied: string[];
}

export async function runMigrations(pool: Pool, migrationsDirectory: string): Promise<MigrationRunResult> {
  const entries = await readdir(migrationsDirectory, { withFileTypes: true });
  const sqlFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.sql'));
  const invalidFilenames = sqlFiles.map((entry) => entry.name).filter((name) => !MIGRATION_FILENAME.test(name));

  if (invalidFilenames.length > 0) {
    throw new Error(`Invalid migration filename(s): ${invalidFilenames.join(', ')}`);
  }

  const migrations = sqlFiles.map((entry) => entry.name).sort();
  const client = await pool.connect();
  let lockAcquired = false;

  try {
    await client.query('SELECT pg_advisory_lock($1::bigint)', [MIGRATION_LOCK_KEY]);
    lockAcquired = true;

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        version varchar(255) PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const result: MigrationRunResult = { applied: [], alreadyApplied: [] };

    for (const migration of migrations) {
      const source = await readFile(join(migrationsDirectory, migration), 'utf8');
      await client.query('BEGIN');

      try {
        const existing = await client.query<{ version: string }>(
          'SELECT version FROM public.schema_migrations WHERE version = $1',
          [migration],
        );

        if (existing.rowCount && existing.rowCount > 0) {
          result.alreadyApplied.push(migration);
          await client.query('COMMIT');
          continue;
        }

        await client.query(source);
        await client.query('INSERT INTO public.schema_migrations (version) VALUES ($1)', [migration]);
        await client.query('COMMIT');
        result.applied.push(migration);
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      }
    }

    return result;
  } finally {
    if (lockAcquired) {
      await client.query('SELECT pg_advisory_unlock($1::bigint)', [MIGRATION_LOCK_KEY]).catch(() => undefined);
    }
    client.release();
  }
}
