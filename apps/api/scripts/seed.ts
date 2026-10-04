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

  const seedFiles = [
    '../../../database/seeds/0001_phase2_catalog.sql',
    '../../../database/seeds/0002_phase3_customers.sql',
    '../../../database/seeds/0003_phase5_inventory.sql',
    '../../../database/seeds/0004_phase6_suppliers_purchases.sql',
  ].map((path) => fileURLToPath(new URL(path, import.meta.url)));
  const seedSql = await Promise.all(seedFiles.map((path) => readFile(path, 'utf8')));
  const pool = new Pool({ connectionString: environment.DATABASE_URL, max: 1 });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    for (const sql of seedSql) await client.query(sql);
    await client.query('COMMIT');
    console.info('Development seed: PASS (4 categories, 6 products, 3 customers, 6 inventory records with sample movements, 2 suppliers, and 1 draft purchase; existing fixture IDs and SKUs are kept).');
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
