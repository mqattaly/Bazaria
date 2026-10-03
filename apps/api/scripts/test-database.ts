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

async function verifyCustomerConstraints(pool: Pool): Promise<void> {
  const name = `Phase 3 customer ${randomUUID()}`;

  await pool.query('BEGIN');
  try {
    const customerResult = await pool.query<{
      id: string;
      is_active: boolean;
      created_at: Date;
      updated_at: Date;
    }>(
      `INSERT INTO bazariya.customers (name, phone, email)
       VALUES ($1, $2, $3)
       RETURNING id, is_active, created_at, updated_at`,
      [name, '09121234567', 'customer@example.com'],
    );
    const customer = customerResult.rows[0];
    assert.ok(customer?.id, 'Customer insert did not return an id.');
    assert.equal(customer.is_active, true, 'Customer active status should default to true.');
    assert.ok(customer.created_at instanceof Date, 'Customer created_at should be a timestamp.');
    assert.ok(customer.updated_at instanceof Date, 'Customer updated_at should be a timestamp.');

    await expectConstraint(
      pool,
      'INSERT INTO bazariya.customers (name) VALUES ($1)',
      [` ${name} `],
      '23514',
      'customers_name_trimmed',
      10,
    );
    await expectConstraint(
      pool,
      'INSERT INTO bazariya.customers (name) VALUES ($1)',
      ['A'],
      '23514',
      'customers_name_length',
      11,
    );
    await expectConstraint(
      pool,
      'INSERT INTO bazariya.customers (name, phone) VALUES ($1, $2)',
      [`Invalid phone ${randomUUID()}`, 'not-a-phone'],
      '23514',
      'customers_phone_valid',
      12,
    );

    const secondCustomer = await pool.query(
      'INSERT INTO bazariya.customers (name, phone) VALUES ($1, $2)',
      [`Second customer ${randomUUID()}`, '09121234567'],
    );
    assert.equal(secondCustomer.rowCount, 1, 'Phone numbers should not be unique.');
    await pool.query(
      'UPDATE bazariya.customers SET phone = NULL, email = NULL WHERE id = $1',
      [customer.id],
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
      [['categories', 'products', 'customers']],
    );
    const domainTables = new Set(tables.rows.map((row) => row.table_name));

    if (missing.length > 0) {
      throw new Error(`Migration tracking is missing: ${missing.join(', ')}`);
    }
    if (domainTables.size !== 3 || !domainTables.has('categories') || !domainTables.has('products') || !domainTables.has('customers')) {
      throw new Error('The versioned migrations did not create the expected catalog and customer domain tables.');
    }

    await verifyCatalogConstraints(pool);
    console.info('Catalog constraints: PASS (trimmed/case-insensitive names, canonical trimmed SKU, unique SKU, non-negative price, valid unit, and RESTRICT delete)');
    await verifyCustomerConstraints(pool);
    console.info('Customer constraints: PASS (trimmed bounded name, optional normalized-format phone, reusable phone numbers, active/timestamp defaults, and nullable contact fields)');

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
