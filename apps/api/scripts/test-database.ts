import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { Pool } from 'pg';
import { getEnvironmentFilePaths } from '../src/config/env-paths.js';
import { parseEnvironment } from '../src/config/environment.js';
import { runMigrations } from '../src/database/migration-runner.js';

interface ConstraintError {
  code: string;
  constraint?: string;
}

function isConstraintError(error: unknown): error is ConstraintError {
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string';
}

async function expectConstraint(
  pool: Pool,
  statement: string,
  values: unknown[],
  expectedCode: string,
  expectedConstraint: string,
  index: number,
): Promise<void> {
  const savepoint = `catalog_constraint_${index}`;
  await pool.query(`SAVEPOINT ${savepoint}`);
  let caught: unknown;
  try {
    await pool.query(statement, values);
  } catch (error) {
    caught = error;
  }
  await pool.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
  await pool.query(`RELEASE SAVEPOINT ${savepoint}`);

  assert.ok(isConstraintError(caught), `Expected database constraint ${expectedConstraint} to reject the statement.`);
  assert.equal(caught.code, expectedCode);
  assert.equal(caught.constraint, expectedConstraint);
}

async function verifyCatalogConstraints(pool: Pool): Promise<void> {
  const categoryName = `Phase 2 test ${randomUUID()}`;
  const sku = `TEST-${randomUUID().slice(0, 8).toUpperCase()}Z`;
  const invalidCategoryId = randomUUID();

  await pool.query('BEGIN');
  try {
    const categoryResult = await pool.query<{ id: string }>(
      'INSERT INTO bazariya.categories (name) VALUES ($1) RETURNING id',
      [categoryName],
    );
    const categoryId = categoryResult.rows[0]?.id;
    assert.ok(categoryId, 'Category insert did not return an id.');

    await expectConstraint(
      pool,
      'INSERT INTO bazariya.categories (name) VALUES ($1)',
      [categoryName.toLocaleLowerCase()],
      '23505',
      'categories_name_unique',
      1,
    );
    await expectConstraint(
      pool,
      'INSERT INTO bazariya.categories (name) VALUES ($1)',
      [` ${categoryName} `],
      '23514',
      'categories_name_trimmed',
      2,
    );

    const productInsert = `
      INSERT INTO bazariya.products (name, sku, category_id, unit, sale_price, purchase_price)
      VALUES ($1, $2, $3, 'piece', 125000, 80000)
    `;
    await pool.query(productInsert, ['Test mug', sku, categoryId]);

    await expectConstraint(pool, productInsert, ['Duplicate mug', sku, categoryId], '23505', 'products_sku_unique', 3);
    await expectConstraint(
      pool,
      productInsert,
      ['Lowercase SKU', sku.toLowerCase(), categoryId],
      '23514',
      'products_sku_uppercase',
      4,
    );
    await expectConstraint(
      pool,
      productInsert,
      ['Untrimmed SKU', ` ${sku} `, categoryId],
      '23514',
      'products_sku_trimmed',
      5,
    );
    await expectConstraint(
      pool,
      `INSERT INTO bazariya.products (name, sku, category_id, unit, sale_price)
       VALUES ('Invalid price', $1, $2, 'piece', -1)`,
      [`${sku}-PRICE`, categoryId],
      '23514',
      'products_sale_price_nonnegative',
      6,
    );
    await expectConstraint(
      pool,
      `INSERT INTO bazariya.products (name, sku, category_id, unit, sale_price)
       VALUES ('Invalid unit', $1, $2, 'unknown', 0)`,
      [`${sku}-UNIT`, categoryId],
      '23514',
      'products_unit_valid',
      7,
    );
    await expectConstraint(
      pool,
      `INSERT INTO bazariya.products (name, sku, category_id, unit, sale_price)
       VALUES ('Invalid category', $1, $2, 'piece', 0)`,
      [`${sku}-CATEGORY`, invalidCategoryId],
      '23503',
      'products_category_id_fkey',
      8,
    );
    await expectConstraint(
      pool,
      'DELETE FROM bazariya.categories WHERE id = $1',
      [categoryId],
      '23503',
      'products_category_id_fkey',
      9,
    );
  } finally {
    await pool.query('ROLLBACK');
  }
}

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
    const tables = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'bazariya' AND table_name = ANY($1::text[])`,
      [['categories', 'products']],
    );
    const catalogTables = new Set(tables.rows.map((row) => row.table_name));

    if (missing.length > 0) {
      throw new Error(`Migration tracking is missing: ${missing.join(', ')}`);
    }
    if (catalogTables.size !== 2 || !catalogTables.has('categories') || !catalogTables.has('products')) {
      throw new Error('The catalog migration did not create both domain tables.');
    }

    await verifyCatalogConstraints(pool);
    console.info('Catalog constraints: PASS (trimmed/case-insensitive names, canonical trimmed SKU, unique SKU, non-negative price, valid unit, and RESTRICT delete)');

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
