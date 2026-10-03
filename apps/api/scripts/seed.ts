import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { Pool } from 'pg';
import { getEnvironmentFilePaths } from '../src/config/env-paths.js';
import { parseEnvironment } from '../src/config/environment.js';

async function main(): Promise<void> {
  loadDotenv({ path: getEnvironmentFilePaths() });
  const environment = parseEnvironment(process.env);
  if (environment.NODE_ENV !== 'development') {
    throw new Error('Development seed data can only be loaded when NODE_ENV=development.');
  }

  const seedFile = fileURLToPath(new URL('../../../database/seeds/0001_phase2_catalog.sql', import.meta.url));
  const seedSql = await readFile(seedFile, 'utf8');
  const pool = new Pool({ connectionString: environment.DATABASE_URL, max: 1 });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(seedSql);
    await client.query('COMMIT');
    console.info('Development catalog seed: PASS (4 categories and 6 products; existing SKUs are kept).');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('Development seed failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
});
