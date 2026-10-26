import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';

const LOCK_ID = 727001;

export interface MigrationResult {
  applied: string[];
  alreadyApplied: string[];
}

function migrationsDirectory(): string {
  return resolve(__dirname, '../../migrations');
}

function checksum(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Applies every pending SQL migration exactly once, in filename order, inside
 * its own transaction, guarded by an advisory lock. Fails loudly if an applied
 * file was modified afterwards.
 */
export async function runMigrations(connectionString: string): Promise<MigrationResult> {
  const client = new Client({ connectionString });
  await client.connect();
  const applied: string[] = [];
  const alreadyApplied: string[] = [];

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);

    const files = readdirSync(migrationsDirectory())
      .filter((file) => file.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      throw new Error('No migration files found');
    }

    const existing = await client.query<{ version: string; checksum: string }>(
      'SELECT version, checksum FROM schema_migrations',
    );
    const existingByVersion = new Map(
      existing.rows.map((row) => [row.version, row.checksum]),
    );

    for (const file of files) {
      const sql = readFileSync(resolve(migrationsDirectory(), file), 'utf8');
      const hash = checksum(sql);
      const previous = existingByVersion.get(file);

      if (previous) {
        if (previous !== hash) {
          throw new Error(
            `Migration ${file} was modified after being applied (checksum mismatch)`,
          );
        }
        alreadyApplied.push(file);
        continue;
      }

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)',
          [file, hash],
        );
        await client.query('COMMIT');
        applied.push(file);
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(
          `Migration ${file} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => undefined);
    await client.end();
  }

  return { applied, alreadyApplied };
}
