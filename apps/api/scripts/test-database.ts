import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { Pool } from 'pg';
import { getEnvironmentFilePaths } from '../src/config/env-paths.js';
import { parseEnvironment } from '../src/config/environment.js';
import { runMigrations } from '../src/database/migration-runner.js';

async function main(): Promise<void> {
  loadDotenv({ path: getEnvironmentFilePaths() });
  const environment = parseEnvironment(process.env);
  const pool = new Pool({
    connectionString: environment.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 5_000,
  });
  const migrationsDirectory = fileURLToPath(new URL('../../../database/migrations', import.meta.url));

  try {
    const connection = await pool.query<{ result: number }>('SELECT 1 AS result');
    if (connection.rows[0]?.result !== 1) {
      throw new Error('PostgreSQL returned an unexpected result for SELECT 1.');
    }
    console.info('Database connection: PASS (SELECT 1)');

    const firstRun = await runMigrations(pool, migrationsDirectory);
    const secondRun = await runMigrations(pool, migrationsDirectory);
    if (secondRun.applied.length > 0) {
      throw new Error('The second migration run unexpectedly applied migrations.');
    }

    const sqlFiles = (await readdir(migrationsDirectory)).filter((file) => file.endsWith('.sql')).sort();
    const records = await pool.query<{ version: string }>(
      'SELECT version FROM public.schema_migrations ORDER BY version',
    );
    const appliedVersions = new Set(records.rows.map((row) => row.version));
    const missing = sqlFiles.filter((file) => !appliedVersions.has(file));
    const schema = await pool.query<{ schema_name: string }>(
      'SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1',
      ['bazariya'],
    );

    if (missing.length > 0) {
      throw new Error(`Migration tracking is missing: ${missing.join(', ')}`);
    }
    if (schema.rowCount !== 1) {
      throw new Error('The foundation migration did not create the bazariya schema.');
    }

    const appliedCount = firstRun.applied.length;
    console.info(
      `Migration execution: PASS (${appliedCount} newly applied, repeat run idempotent; ${sqlFiles.length} versioned migration(s) verified)`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('Database test failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
});
