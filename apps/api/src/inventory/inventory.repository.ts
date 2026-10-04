import { Injectable } from '@nestjs/common';
import type {
  CreateStockMovementInput,
  CreateStockMovementResult,
  InventoryItem,
  InventoryListQuery,
  PaginatedData,
  ProductUnit,
  StockMovement,
  StockMovementListQuery,
} from '@bazariya/shared';
import type { PoolClient, QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service.js';
import { calculateStockMovement } from './inventory.calculations.js';
import { InventoryDomainError } from './inventory.errors.js';

interface InventoryRow extends QueryResultRow {
  productId: string;
  productName: string;
  productSku: string;
  productUnit: ProductUnit;
  productIsActive: boolean;
  quantity: string | number;
  minimumQuantity: string | number;
  isLowStock: boolean;
  status: InventoryItem['status'];
  updatedAt: Date | string;
}

interface MovementRow extends QueryResultRow {
  id: string;
  productId: string;
  type: StockMovement['type'];
  quantity: string | number;
  beforeQuantity: string | number;
  afterQuantity: string | number;
  note: string | null;
  createdAt: Date | string;
}

interface ProductLockRow extends QueryResultRow {
  id: string;
  isActive: boolean;
}

interface LockedInventoryRow extends QueryResultRow {
  quantity: string | number;
  minimumQuantity: string | number;
}

interface CountRow extends QueryResultRow {
  total: string | number;
}

const inventoryFields = `
  p.id AS "productId",
  p.name AS "productName",
  p.sku AS "productSku",
  p.unit AS "productUnit",
  p.is_active AS "productIsActive",
  COALESCE(i.quantity, 0)::text AS quantity,
  COALESCE(i.minimum_quantity, 0)::text AS "minimumQuantity",
  (COALESCE(i.quantity, 0) <= COALESCE(i.minimum_quantity, 0)) AS "isLowStock",
  CASE
    WHEN COALESCE(i.quantity, 0) = 0 THEN 'out-of-stock'
    WHEN COALESCE(i.quantity, 0) <= COALESCE(i.minimum_quantity, 0) THEN 'low-stock'
    ELSE 'in-stock'
  END AS status,
  COALESCE(i.updated_at, p.created_at) AS "updatedAt"
`;

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toSafeQuantity(value: string | number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error('Inventory quantity is outside the safe integer range.');
  }
  return parsed;
}

function toSafeCount(value: string | number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error('Inventory result count is outside the safe integer range.');
  }
  return parsed;
}

function mapInventory(row: InventoryRow): InventoryItem {
  return {
    product: {
      id: row.productId,
      name: row.productName,
      sku: row.productSku,
      unit: row.productUnit,
      isActive: row.productIsActive,
    },
    quantity: toSafeQuantity(row.quantity),
    minimumQuantity: toSafeQuantity(row.minimumQuantity),
    isLowStock: row.isLowStock,
    status: row.status,
    updatedAt: toIsoString(row.updatedAt),
  };
}

function mapMovement(row: MovementRow): StockMovement {
  return {
    id: row.id,
    productId: row.productId,
    type: row.type,
    quantity: toSafeQuantity(row.quantity),
    beforeQuantity: toSafeQuantity(row.beforeQuantity),
    afterQuantity: toSafeQuantity(row.afterQuantity),
    note: row.note,
    createdAt: toIsoString(row.createdAt),
  };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

function safePageCount(total: number, pageSize: number): number {
  return Math.ceil(total / pageSize);
}

@Injectable()
export class InventoryRepository {
  constructor(private readonly database: DatabaseService) {}

  async list(query: InventoryListQuery): Promise<PaginatedData<InventoryItem>> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    const search = query.search?.trim();

    if (search) {
      values.push(`%${escapeLike(search)}%`);
      const parameter = values.length;
      conditions.push(
        `(p.name ILIKE $${parameter} ESCAPE E'\\\\' OR p.sku ILIKE $${parameter} ESCAPE E'\\\\')`,
      );
    }

    const quantity = 'COALESCE(i.quantity, 0)';
    const minimum = 'COALESCE(i.minimum_quantity, 0)';
    if (query.status === 'out-of-stock') conditions.push(`${quantity} = 0`);
    if (query.status === 'low-stock') conditions.push(`${quantity} > 0 AND ${quantity} <= ${minimum}`);
    if (query.status === 'in-stock') conditions.push(`${quantity} > ${minimum}`);
    if (query.lowStock === true) conditions.push(`${quantity} <= ${minimum}`);
    if (query.lowStock === false) conditions.push(`${quantity} > ${minimum}`);

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await this.database.query<CountRow>(
      `SELECT count(*)::bigint AS total
       FROM bazariya.products p
       LEFT JOIN bazariya.inventory i ON i.product_id = p.id
       ${where}`,
      values,
    );
    const total = toSafeCount(countResult.rows[0]?.total ?? 0);
    const offset = (query.page - 1) * query.pageSize;
    const paginationValues = [...values, query.pageSize, offset];
    const limitParameter = values.length + 1;
    const offsetParameter = values.length + 2;
    const result = await this.database.query<InventoryRow>(
      `SELECT ${inventoryFields}
       FROM bazariya.products p
       LEFT JOIN bazariya.inventory i ON i.product_id = p.id
       ${where}
       ORDER BY lower(p.name), p.id
       LIMIT $${limitParameter} OFFSET $${offsetParameter}`,
      paginationValues,
    );

    return {
      items: result.rows.map(mapInventory),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: safePageCount(total, query.pageSize),
      },
    };
  }

  async findByProductId(productId: string): Promise<InventoryItem | null> {
    const result = await this.database.query<InventoryRow>(
      `SELECT ${inventoryFields}
       FROM bazariya.products p
       LEFT JOIN bazariya.inventory i ON i.product_id = p.id
       WHERE p.id = $1`,
      [productId],
    );
    const row = result.rows[0];
    return row ? mapInventory(row) : null;
  }

  async updateMinimum(productId: string, minimumQuantity: number): Promise<InventoryItem> {
    return this.database.transaction(async (client) => {
      await this.lockProduct(client, productId);
      await this.ensureInventoryRow(client, productId);
      const current = await this.lockInventory(client, productId);
      await client.query(
        `UPDATE bazariya.inventory
         SET minimum_quantity = $2, updated_at = now()
         WHERE product_id = $1`,
        [productId, minimumQuantity],
      );
      const updated = await this.findWithClient(client, productId);
      if (!updated) throw this.inventoryNotFound();
      if (!current) throw this.inventoryNotFound();
      return updated;
    });
  }

  async createMovement(productId: string, input: CreateStockMovementInput): Promise<CreateStockMovementResult> {
    return this.database.transaction(async (client) => {
      const product = await this.lockProduct(client, productId);
      if (!product.isActive) {
        throw new InventoryDomainError(
          'PRODUCT_NOT_AVAILABLE',
          'ثبت گردش موجودی برای محصول غیرفعال امکان‌پذیر نیست.',
          409,
        );
      }

      await this.ensureInventoryRow(client, productId);
      const current = await this.lockInventory(client, productId);
      if (!current) throw this.inventoryNotFound();
      const beforeQuantity = toSafeQuantity(current.quantity);
      const calculated = calculateStockMovement(beforeQuantity, input);

      await client.query(
        `UPDATE bazariya.inventory
         SET quantity = $2, updated_at = now()
         WHERE product_id = $1`,
        [productId, calculated.afterQuantity],
      );
      const movementResult = await client.query<MovementRow>(
        `INSERT INTO bazariya.stock_movements (
           product_id, type, quantity, before_quantity, after_quantity, note
         ) VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING
           id,
           product_id AS "productId",
           type,
           quantity::text AS quantity,
           before_quantity::text AS "beforeQuantity",
           after_quantity::text AS "afterQuantity",
           note,
           created_at AS "createdAt"`,
        [
          productId,
          calculated.type,
          calculated.quantity,
          calculated.beforeQuantity,
          calculated.afterQuantity,
          input.note ?? null,
        ],
      );
      const movementRow = movementResult.rows[0];
      if (!movementRow) throw new Error('Stock movement insert did not return a row.');
      const inventory = await this.findWithClient(client, productId);
      if (!inventory) throw this.inventoryNotFound();

      return { inventory, movement: mapMovement(movementRow) };
    });
  }

  async listMovements(
    productId: string,
    query: StockMovementListQuery,
  ): Promise<PaginatedData<StockMovement>> {
    const conditions = ['product_id = $1'];
    const values: unknown[] = [productId];

    if (query.type) {
      values.push(query.type);
      conditions.push(`type = $${values.length}`);
    }
    if (query.from) {
      values.push(query.from);
      conditions.push(`created_at >= $${values.length}`);
    }
    if (query.to) {
      values.push(query.to);
      conditions.push(`created_at <= $${values.length}`);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const countResult = await this.database.query<CountRow>(
      `SELECT count(*)::bigint AS total FROM bazariya.stock_movements ${where}`,
      values,
    );
    const total = toSafeCount(countResult.rows[0]?.total ?? 0);
    const offset = (query.page - 1) * query.pageSize;
    const pageValues = [...values, query.pageSize, offset];
    const limitParameter = values.length + 1;
    const offsetParameter = values.length + 2;
    const result = await this.database.query<MovementRow>(
      `SELECT
         id,
         product_id AS "productId",
         type,
         quantity::text AS quantity,
         before_quantity::text AS "beforeQuantity",
         after_quantity::text AS "afterQuantity",
         note,
         created_at AS "createdAt"
       FROM bazariya.stock_movements
       ${where}
       ORDER BY created_at DESC, id DESC
       LIMIT $${limitParameter} OFFSET $${offsetParameter}`,
      pageValues,
    );

    return {
      items: result.rows.map(mapMovement),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: safePageCount(total, query.pageSize),
      },
    };
  }

  private async lockProduct(client: PoolClient, productId: string): Promise<ProductLockRow> {
    const result = await client.query<ProductLockRow>(
      `SELECT id, is_active AS "isActive"
       FROM bazariya.products
       WHERE id = $1
       FOR SHARE`,
      [productId],
    );
    const product = result.rows[0];
    if (!product) {
      throw new InventoryDomainError('PRODUCT_NOT_FOUND', 'محصول موردنظر پیدا نشد.', 404);
    }
    return product;
  }

  private async ensureInventoryRow(client: PoolClient, productId: string): Promise<void> {
    await client.query(
      `INSERT INTO bazariya.inventory (product_id)
       VALUES ($1)
       ON CONFLICT (product_id) DO NOTHING`,
      [productId],
    );
  }

  private async lockInventory(client: PoolClient, productId: string): Promise<LockedInventoryRow | null> {
    const result = await client.query<LockedInventoryRow>(
      `SELECT quantity::text AS quantity, minimum_quantity::text AS "minimumQuantity"
       FROM bazariya.inventory
       WHERE product_id = $1
       FOR UPDATE`,
      [productId],
    );
    return result.rows[0] ?? null;
  }

  private async findWithClient(client: PoolClient, productId: string): Promise<InventoryItem | null> {
    const result = await client.query<InventoryRow>(
      `SELECT ${inventoryFields}
       FROM bazariya.products p
       LEFT JOIN bazariya.inventory i ON i.product_id = p.id
       WHERE p.id = $1`,
      [productId],
    );
    const row = result.rows[0];
    return row ? mapInventory(row) : null;
  }

  private inventoryNotFound(): InventoryDomainError {
    return new InventoryDomainError('INVENTORY_NOT_FOUND', 'اطلاعات موجودی محصول پیدا نشد.', 404);
  }
}
