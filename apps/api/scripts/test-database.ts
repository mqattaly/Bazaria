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
  const savepoint = `domain_constraint_${index}`;
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

async function verifyOrderConstraints(pool: Pool): Promise<void> {
  const categoryName = `Phase 4 order test ${randomUUID()}`;
  const sku = `ORDER-${randomUUID().slice(0, 8).toUpperCase()}Z`;
  const customerName = `Phase 4 customer ${randomUUID()}`;

  await pool.query('BEGIN');
  try {
    const category = await pool.query<{ id: string }>(
      'INSERT INTO bazariya.categories (name) VALUES ($1) RETURNING id',
      [categoryName],
    );
    const categoryId = category.rows[0]?.id;
    assert.ok(categoryId, 'Order test category insert did not return an id.');

    const product = await pool.query<{ id: string }>(
      `INSERT INTO bazariya.products (name, sku, category_id, unit, sale_price)
       VALUES ('Order test tea', $1, $2, 'pack', 125000)
       RETURNING id`,
      [sku, categoryId],
    );
    const productId = product.rows[0]?.id;
    assert.ok(productId, 'Order test product insert did not return an id.');

    const customer = await pool.query<{ id: string }>(
      'INSERT INTO bazariya.customers (name) VALUES ($1) RETURNING id',
      [customerName],
    );
    const customerId = customer.rows[0]?.id;
    assert.ok(customerId, 'Order test customer insert did not return an id.');

    const sequence = await pool.query<{ value: string }>(
      "SELECT nextval('bazariya.order_number_seq')::text AS value",
    );
    const orderNumber = `BAZ-${sequence.rows[0]?.value.padStart(9, '0')}`;
    const orderResult = await pool.query<{
      id: string;
      status: string;
      created_at: Date;
      confirmed_at: Date | null;
    }>(
      `INSERT INTO bazariya.orders (order_number, customer_id, note)
       VALUES ($1, $2, 'Original snapshot')
       RETURNING id, status, created_at, confirmed_at`,
      [orderNumber, customerId],
    );
    const order = orderResult.rows[0];
    assert.ok(order?.id, 'Order insert did not return an id.');
    assert.equal(order.status, 'draft', 'New orders should default to draft.');
    assert.ok(order.created_at instanceof Date, 'Order created_at should be a timestamp.');
    assert.equal(order.confirmed_at, null, 'Draft orders should not have a confirmation timestamp.');

    await expectConstraint(
      pool,
      'INSERT INTO bazariya.orders (order_number) VALUES ($1)',
      [orderNumber],
      '23505',
      'orders_order_number_key',
      13,
    );
    await expectConstraint(
      pool,
      'INSERT INTO bazariya.orders (order_number) VALUES ($1)',
      ['not-an-order-number'],
      '23514',
      'orders_order_number_valid',
      14,
    );
    await expectConstraint(
      pool,
      'UPDATE bazariya.orders SET discount = 1 WHERE id = $1',
      [order.id],
      '23514',
      'orders_amounts_consistent',
      15,
    );
    await expectConstraint(
      pool,
      'UPDATE bazariya.orders SET subtotal = $2, total = $2 WHERE id = $1',
      [order.id, '9007199254740992'],
      '23514',
      'orders_amounts_safe',
      16,
    );

    const insertItem = `
      INSERT INTO bazariya.order_items (
        order_id, product_id, product_name, sku, unit, quantity, unit_price, line_total
      ) VALUES ($1, $2, $3, $4, 'pack', 2, 125000, 250000)
    `;
    await expectConstraint(
      pool,
      `INSERT INTO bazariya.order_items (
         order_id, product_id, product_name, sku, unit, quantity, unit_price, line_total
       ) VALUES ($1, $2, 'Invalid total', $3, 'pack', 2, 125000, 250001)`,
      [order.id, productId, sku],
      '23514',
      'order_items_line_total_consistent',
      17,
    );
    await pool.query(insertItem, [order.id, productId, 'Order test tea', sku]);
    await pool.query(
      'UPDATE bazariya.orders SET subtotal = 250000, discount = 10000, total = 240000 WHERE id = $1',
      [order.id],
    );
    await pool.query('SET CONSTRAINTS ALL IMMEDIATE');
    await pool.query('SET CONSTRAINTS ALL DEFERRED');
    await pool.query("UPDATE bazariya.products SET name = 'Updated tea', sale_price = 150000 WHERE id = $1", [productId]);
    const snapshot = await pool.query<{ product_name: string; sku: string; unit: string; unit_price: string }>(
      `SELECT product_name, sku, unit, unit_price::text AS unit_price
       FROM bazariya.order_items WHERE order_id = $1`,
      [order.id],
    );
    assert.deepEqual(snapshot.rows[0], {
      product_name: 'Order test tea',
      sku,
      unit: 'pack',
      unit_price: '125000',
    }, 'Order item fields and price should remain snapshots after product updates.');

    await pool.query("UPDATE bazariya.orders SET status = 'confirmed' WHERE id = $1", [order.id]);
    const confirmed = await pool.query<{ status: string; confirmed_at: Date | null }>(
      'SELECT status, confirmed_at FROM bazariya.orders WHERE id = $1',
      [order.id],
    );
    assert.equal(confirmed.rows[0]?.status, 'confirmed');
    assert.ok(confirmed.rows[0]?.confirmed_at instanceof Date, 'Confirmation timestamp should be recorded.');

    const secondSequence = await pool.query<{ value: string }>(
      "SELECT nextval('bazariya.order_number_seq')::text AS value",
    );
    const draftOrderNumber = `BAZ-${secondSequence.rows[0]?.value.padStart(9, '0')}`;
    const draft = await pool.query<{ id: string }>(
      'INSERT INTO bazariya.orders (order_number) VALUES ($1) RETURNING id',
      [draftOrderNumber],
    );
    const draftOrderId = draft.rows[0]?.id;
    assert.ok(draftOrderId, 'Draft order insert did not return an id.');

    await expectConstraint(
      pool,
      'UPDATE bazariya.order_items SET order_id = $2 WHERE order_id = $1',
      [order.id, draftOrderId],
      '23514',
      'order_items_draft_only',
      18,
    );
    await expectConstraint(
      pool,
      "UPDATE bazariya.orders SET note = 'Changed after confirmation' WHERE id = $1",
      [order.id],
      '23514',
      'orders_confirmed_immutable',
      19,
    );
    await expectConstraint(
      pool,
      'DELETE FROM bazariya.order_items WHERE order_id = $1',
      [order.id],
      '23514',
      'order_items_draft_only',
      20,
    );
    await expectConstraint(
      pool,
      'DELETE FROM bazariya.products WHERE id = $1',
      [productId],
      '23503',
      'order_items_product_id_fkey',
      21,
    );
    await expectConstraint(
      pool,
      'DELETE FROM bazariya.orders WHERE id = $1',
      [order.id],
      '23514',
      'orders_delete_draft_only',
      22,
    );

    await pool.query("UPDATE bazariya.orders SET status = 'cancelled' WHERE id = $1", [order.id]);
    const cancelled = await pool.query<{ status: string; cancelled_at: Date | null }>(
      'SELECT status, cancelled_at FROM bazariya.orders WHERE id = $1',
      [order.id],
    );
    assert.equal(cancelled.rows[0]?.status, 'cancelled');
    assert.ok(cancelled.rows[0]?.cancelled_at instanceof Date, 'Cancellation timestamp should be recorded.');
    await expectConstraint(
      pool,
      "UPDATE bazariya.orders SET note = 'Changed after cancellation' WHERE id = $1",
      [order.id],
      '23514',
      'orders_cancelled_immutable',
      23,
    );
    await expectConstraint(
      pool,
      'DELETE FROM bazariya.order_items WHERE order_id = $1',
      [order.id],
      '23514',
      'order_items_draft_only',
      24,
    );

    await pool.query('DELETE FROM bazariya.customers WHERE id = $1', [customerId]);
    const customerReference = await pool.query<{ customer_id: string | null }>(
      'SELECT customer_id FROM bazariya.orders WHERE id = $1',
      [order.id],
    );
    assert.equal(customerReference.rows[0]?.customer_id, null, 'Deleting a customer should preserve its order with a null reference.');

    await expectConstraint(
      pool,
      `INSERT INTO bazariya.order_items (
         order_id, product_id, product_name, sku, unit, quantity, unit_price, line_total
       ) VALUES ($1, $2, 'Invalid quantity', $3, 'pack', 0, 150000, 0)`,
      [draftOrderId, productId, sku],
      '23514',
      'order_items_quantity_valid',
      25,
    );

    await pool.query(
      `INSERT INTO bazariya.order_items (
         order_id, product_id, product_name, sku, unit, quantity, unit_price, line_total
       ) VALUES ($1, $2, 'Updated tea', $3, 'pack', 1, 150000, 150000)`,
      [draftOrderId, productId, sku],
    );
    await pool.query('UPDATE bazariya.orders SET subtotal = 150000, total = 150000 WHERE id = $1', [draftOrderId]);
    await expectConstraint(
      pool,
      `INSERT INTO bazariya.order_items (
         order_id, product_id, product_name, sku, unit, quantity, unit_price, line_total
       ) VALUES ($1, $2, 'Duplicate row', $3, 'pack', 1, 150000, 150000)`,
      [draftOrderId, productId, sku],
      '23505',
      'order_items_product_unique',
      26,
    );

    await pool.query('DELETE FROM bazariya.orders WHERE id = $1', [draftOrderId]);
    const cascadedItems = await pool.query<{ total: string }>(
      'SELECT count(*)::text AS total FROM bazariya.order_items WHERE order_id = $1',
      [draftOrderId],
    );
    assert.equal(cascadedItems.rows[0]?.total, '0', 'Deleting a draft order should cascade only its order items.');
  } finally {
    await pool.query('ROLLBACK');
  }
}

async function verifyDeferredOrderTotals(pool: Pool): Promise<void> {
  const sequence = await pool.query<{ value: string }>(
    "SELECT nextval('bazariya.order_number_seq')::text AS value",
  );
  const orderNumber = `BAZ-${sequence.rows[0]?.value.padStart(9, '0')}`;
  await pool.query('BEGIN');
  let caught: unknown;
  try {
    await pool.query(
      'INSERT INTO bazariya.orders (order_number, subtotal, total) VALUES ($1, 1, 1)',
      [orderNumber],
    );
    await pool.query('COMMIT');
  } catch (error) {
    caught = error;
    await pool.query('ROLLBACK').catch(() => undefined);
  }
  assert.ok(isConstraintError(caught), 'Deferred order/item total validation should reject a mismatched subtotal at commit.');
  assert.equal(caught.code, '23514');
  assert.equal(caught.constraint, 'orders_item_subtotal_consistent');
}

async function verifyInventoryConstraints(pool: Pool): Promise<void> {
  const categoryName = `Phase 5 inventory test ${randomUUID()}`;
  const sku = `INV-${randomUUID().slice(0, 8).toUpperCase()}Z`;
  const secondSku = `INV-${randomUUID().slice(0, 8).toUpperCase()}Z`;

  await pool.query('BEGIN');
  try {
    const category = await pool.query<{ id: string }>(
      'INSERT INTO bazariya.categories (name) VALUES ($1) RETURNING id',
      [categoryName],
    );
    const categoryId = category.rows[0]?.id;
    assert.ok(categoryId, 'Inventory test category insert did not return an id.');

    const product = await pool.query<{ id: string }>(
      `INSERT INTO bazariya.products (name, sku, category_id, unit, sale_price)
       VALUES ('Inventory test item', $1, $2, 'piece', 100)
       RETURNING id`,
      [sku, categoryId],
    );
    const productId = product.rows[0]?.id;
    assert.ok(productId, 'Inventory test product insert did not return an id.');

    const inventory = await pool.query<{
      quantity: string;
      minimum_quantity: string;
      updated_at: Date;
    }>(
      `INSERT INTO bazariya.inventory (product_id)
       VALUES ($1)
       RETURNING quantity::text AS quantity, minimum_quantity::text AS minimum_quantity, updated_at`,
      [productId],
    );
    assert.equal(inventory.rows[0]?.quantity, '0', 'Inventory should default to zero stock.');
    assert.equal(inventory.rows[0]?.minimum_quantity, '0', 'Inventory minimum should default to zero.');
    assert.ok(inventory.rows[0]?.updated_at instanceof Date, 'Inventory updated_at should be a timestamp.');

    await expectConstraint(
      pool,
      'INSERT INTO bazariya.inventory (product_id) VALUES ($1)',
      [productId],
      '23505',
      'inventory_product_id_unique',
      30,
    );
    await expectConstraint(
      pool,
      'UPDATE bazariya.inventory SET quantity = -1 WHERE product_id = $1',
      [productId],
      '23514',
      'inventory_quantity_nonnegative',
      31,
    );
    await expectConstraint(
      pool,
      'UPDATE bazariya.inventory SET minimum_quantity = -1 WHERE product_id = $1',
      [productId],
      '23514',
      'inventory_minimum_nonnegative',
      32,
    );
    await expectConstraint(
      pool,
      'UPDATE bazariya.inventory SET quantity = $2 WHERE product_id = $1',
      [productId, '9007199254740992'],
      '23514',
      'inventory_quantity_nonnegative',
      41,
    );
    await expectConstraint(
      pool,
      'UPDATE bazariya.inventory SET minimum_quantity = $2 WHERE product_id = $1',
      [productId, '9007199254740992'],
      '23514',
      'inventory_minimum_nonnegative',
      42,
    );
    await expectConstraint(
      pool,
      'INSERT INTO bazariya.inventory (product_id) VALUES ($1)',
      [randomUUID()],
      '23503',
      'inventory_product_id_fkey',
      33,
    );

    const movement = await pool.query<{ id: string }>(
      `INSERT INTO bazariya.stock_movements (
         product_id, type, quantity, before_quantity, after_quantity, note
       ) VALUES ($1, 'IN', 5, 0, 5, 'opening stock')
       RETURNING id`,
      [productId],
    );
    const movementId = movement.rows[0]?.id;
    assert.ok(movementId, 'Stock movement insert did not return an id.');

    await expectConstraint(
      pool,
      `INSERT INTO bazariya.stock_movements (product_id, type, quantity, before_quantity, after_quantity)
       VALUES ($1, 'RETURN', 1, 0, 1)`,
      [productId],
      '23514',
      'stock_movements_type_valid',
      34,
    );
    await expectConstraint(
      pool,
      `INSERT INTO bazariya.stock_movements (product_id, type, quantity, before_quantity, after_quantity)
       VALUES ($1, 'IN', 0, 0, 0)`,
      [productId],
      '23514',
      'stock_movements_values_consistent',
      35,
    );
    await expectConstraint(
      pool,
      `INSERT INTO bazariya.stock_movements (product_id, type, quantity, before_quantity, after_quantity)
       VALUES ($1, 'IN', 5, 0, 4)`,
      [productId],
      '23514',
      'stock_movements_values_consistent',
      36,
    );
    await expectConstraint(
      pool,
      `INSERT INTO bazariya.stock_movements (product_id, type, quantity, before_quantity, after_quantity)
       VALUES ($1, 'IN', $2, 0, $2)`,
      [productId, '9007199254740992'],
      '23514',
      'stock_movements_quantities_safe',
      43,
    );
    await expectConstraint(
      pool,
      `INSERT INTO bazariya.stock_movements (product_id, type, quantity, before_quantity, after_quantity, note)
       VALUES ($1, 'ADJUSTMENT', 0, 0, 0, '  ' )`,
      [productId],
      '23514',
      'stock_movements_note_trimmed',
      37,
    );
    await expectConstraint(
      pool,
      'UPDATE bazariya.stock_movements SET note = $2 WHERE id = $1',
      [movementId, 'changed history'],
      '23514',
      'stock_movements_immutable',
      38,
    );
    await expectConstraint(
      pool,
      'DELETE FROM bazariya.stock_movements WHERE id = $1',
      [movementId],
      '23514',
      'stock_movements_immutable',
      39,
    );
    await expectConstraint(
      pool,
      'DELETE FROM bazariya.products WHERE id = $1',
      [productId],
      '23503',
      'stock_movements_product_id_fkey',
      40,
    );

    const secondProduct = await pool.query<{ id: string }>(
      `INSERT INTO bazariya.products (name, sku, category_id, unit, sale_price)
       VALUES ('Cascade inventory item', $1, $2, 'piece', 0)
       RETURNING id`,
      [secondSku, categoryId],
    );
    const secondProductId = secondProduct.rows[0]?.id;
    assert.ok(secondProductId, 'Cascade test product insert did not return an id.');
    await pool.query('INSERT INTO bazariya.inventory (product_id, quantity, minimum_quantity) VALUES ($1, 7, 2)', [secondProductId]);
    await pool.query('DELETE FROM bazariya.products WHERE id = $1', [secondProductId]);
    const cascadedInventory = await pool.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM bazariya.inventory WHERE product_id = $1',
      [secondProductId],
    );
    assert.equal(cascadedInventory.rows[0]?.count, '0', 'Inventory state should cascade when a Product without stock history is deleted.');
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
      [['categories', 'products', 'customers', 'orders', 'order_items', 'inventory', 'stock_movements']],
    );
    const domainTables = new Set(tables.rows.map((row) => row.table_name));

    if (missing.length > 0) {
      throw new Error(`Migration tracking is missing: ${missing.join(', ')}`);
    }
    if (
      domainTables.size !== 7
      || !domainTables.has('categories')
      || !domainTables.has('products')
      || !domainTables.has('customers')
      || !domainTables.has('orders')
      || !domainTables.has('order_items')
      || !domainTables.has('inventory')
      || !domainTables.has('stock_movements')
    ) {
      throw new Error('The versioned migrations did not create the expected catalog, customer, order, and inventory domain tables.');
    }

    await verifyCatalogConstraints(pool);
    console.info('Catalog constraints: PASS (trimmed/case-insensitive names, canonical trimmed SKU, unique SKU, non-negative price, valid unit, and RESTRICT delete)');
    await verifyCustomerConstraints(pool);
    console.info('Customer constraints: PASS (trimmed bounded name, optional normalized-format phone, reusable phone numbers, active/timestamp defaults, and nullable contact fields)');
    await verifyOrderConstraints(pool);
    console.info('Order constraints: PASS (unique server-style number, draft defaults, snapshot history, safe lifecycle, active item restrictions, optional customer SET NULL, and draft-only cascade)');
    await verifyDeferredOrderTotals(pool);
    console.info('Order totals: PASS (deferred item subtotal invariant is enforced at commit)');
    await verifyInventoryConstraints(pool);
    console.info('Inventory constraints: PASS (one bounded nonnegative record per Product, consistent immutable movement snapshots, safe Product delete behavior, and inventory-state cascade)');

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
