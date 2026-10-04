import { Injectable } from '@nestjs/common';
import type {
  PaginatedData,
  ProductUnit,
  Purchase,
  PurchaseDetails,
  PurchaseItem,
  PurchaseListItem,
  PurchaseListQuery,
  PurchaseStatus,
} from '@bazariya/shared';
import { PRODUCT_UNITS } from '@bazariya/shared';
import type { PoolClient, QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service.js';
import { PurchaseDomainError } from './purchases.errors.js';

export interface PurchaseProductSnapshot {
  id: string;
  name: string;
  sku: string;
  unit: ProductUnit;
}

export interface PurchaseLineRecord extends PurchaseProductSnapshot {
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PurchaseTotals {
  subtotal: number;
  discount: number;
  total: number;
}

export interface PurchaseWriteValues extends PurchaseTotals {
  supplierId: string;
  note: string | null;
  items: readonly PurchaseLineRecord[];
}

interface PurchaseRow extends QueryResultRow {
  id: string;
  purchaseNumber: string;
  supplierId: string;
  status: string;
  subtotal: string | number;
  discount: string | number;
  total: string | number;
  note: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  supplierName: string;
  supplierPhone: string | null;
  supplierEmail: string | null;
  supplierIsActive: boolean;
  itemCount?: string | number;
}

interface JoinedPurchaseRow extends PurchaseRow {
  itemId: string | null;
  productId: string | null;
  productNameSnapshot: string | null;
  productSkuSnapshot: string | null;
  unitSnapshot: string | null;
  unitPrice: string | number | null;
  quantity: string | number | null;
  lineTotal: string | number | null;
}

interface ProductRow extends QueryResultRow {
  id: string;
  name: string;
  sku: string;
  unit: string;
  isActive: boolean;
}

interface CountRow extends QueryResultRow {
  total: string | number;
}

interface SequenceRow extends QueryResultRow {
  value: string;
}

const purchaseColumns = `
  p.id,
  p.purchase_number AS "purchaseNumber",
  p.supplier_id AS "supplierId",
  p.status,
  p.subtotal::text AS subtotal,
  p.discount::text AS discount,
  p.total::text AS total,
  p.note,
  p.created_at AS "createdAt",
  p.updated_at AS "updatedAt"
`;

const unitValues = new Set<string>(PRODUCT_UNITS);

function toIsoString(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Stored purchase timestamp is invalid.');
  return date.toISOString();
}

function toSafeInteger(value: string | number, field: string, min = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min) throw new Error(`Stored ${field} is not a safe integer.`);
  return parsed;
}

function toSafeCount(value: string | number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error('Purchase count is outside the safe integer range.');
  return parsed;
}

function mapPurchase(row: PurchaseRow): Purchase {
  if (row.status !== 'draft' && row.status !== 'confirmed' && row.status !== 'cancelled') {
    throw new Error('Stored purchase status is invalid.');
  }
  return {
    id: row.id,
    purchaseNumber: row.purchaseNumber,
    supplierId: row.supplierId,
    status: row.status as PurchaseStatus,
    subtotal: toSafeInteger(row.subtotal, 'purchase subtotal'),
    discount: toSafeInteger(row.discount, 'purchase discount'),
    total: toSafeInteger(row.total, 'purchase total'),
    note: row.note,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

function mapPurchaseItem(row: JoinedPurchaseRow): PurchaseItem {
  if (
    row.itemId === null
    || row.productId === null
    || row.productNameSnapshot === null
    || row.productSkuSnapshot === null
    || row.unitSnapshot === null
    || row.unitPrice === null
    || row.quantity === null
    || row.lineTotal === null
  ) {
    throw new Error('Purchase item row is incomplete.');
  }
  if (!unitValues.has(row.unitSnapshot)) throw new Error('Stored purchase item unit is invalid.');
  return {
    id: row.itemId,
    purchaseId: row.id,
    productId: row.productId,
    productNameSnapshot: row.productNameSnapshot,
    productSkuSnapshot: row.productSkuSnapshot,
    unitSnapshot: row.unitSnapshot as ProductUnit,
    unitPrice: toSafeInteger(row.unitPrice, 'purchase item unit price'),
    quantity: toSafeInteger(row.quantity, 'purchase item quantity', 1),
    lineTotal: toSafeInteger(row.lineTotal, 'purchase item line total'),
  };
}

function mapPurchaseDetails(rows: JoinedPurchaseRow[]): PurchaseDetails | null {
  const first = rows[0];
  if (!first) return null;
  return {
    ...mapPurchase(first),
    supplier: {
      id: first.supplierId,
      name: first.supplierName,
      phone: first.supplierPhone,
      email: first.supplierEmail,
      isActive: first.supplierIsActive,
    },
    items: rows.filter((row) => row.itemId !== null).map(mapPurchaseItem),
  };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

function buildListConditions(query: PurchaseListQuery): { conditions: string[]; values: unknown[] } {
  const conditions: string[] = [];
  const values: unknown[] = [];
  if (query.search?.trim()) {
    values.push(`%${escapeLike(query.search.trim())}%`);
    const parameter = values.length;
    conditions.push(`(
      p.purchase_number ILIKE $${parameter} ESCAPE E'\\\\'
      OR s.name ILIKE $${parameter} ESCAPE E'\\\\'
    )`);
  }
  if (query.supplierId) {
    values.push(query.supplierId);
    conditions.push(`p.supplier_id = $${values.length}`);
  }
  if (query.status) {
    values.push(query.status);
    conditions.push(`p.status = $${values.length}`);
  }
  if (query.from) {
    values.push(new Date(query.from).toISOString());
    conditions.push(`p.created_at >= $${values.length}::timestamptz`);
  }
  if (query.to) {
    values.push(new Date(query.to).toISOString());
    conditions.push(`p.created_at <= $${values.length}::timestamptz`);
  }
  return { conditions, values };
}

@Injectable()
export class PurchasesRepository {
  constructor(private readonly database: DatabaseService) {}

  async list(query: PurchaseListQuery): Promise<PaginatedData<PurchaseListItem>> {
    const { conditions, values } = buildListConditions(query);
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await this.database.query<CountRow>(
      `SELECT count(*)::bigint AS total
       FROM bazariya.purchases p
       JOIN bazariya.suppliers s ON s.id = p.supplier_id
       ${where}`,
      values,
    );
    const total = toSafeCount(countResult.rows[0]?.total ?? 0);
    const limitParameter = values.length + 1;
    const offsetParameter = values.length + 2;
    const offset = (query.page - 1) * query.pageSize;
    const result = await this.database.query<PurchaseRow>(
      `SELECT ${purchaseColumns},
              s.name AS "supplierName",
              count(pi.id)::bigint AS "itemCount"
       FROM bazariya.purchases p
       JOIN bazariya.suppliers s ON s.id = p.supplier_id
       LEFT JOIN bazariya.purchase_items pi ON pi.purchase_id = p.id
       ${where}
       GROUP BY p.id, s.name
       ORDER BY p.created_at DESC, p.id DESC
       LIMIT $${limitParameter} OFFSET $${offsetParameter}`,
      [...values, query.pageSize, offset],
    );
    return {
      items: result.rows.map((row) => ({
        ...mapPurchase(row),
        supplierName: row.supplierName,
        itemCount: toSafeCount(row.itemCount ?? 0),
      })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async findById(id: string): Promise<PurchaseDetails | null> {
    const result = await this.database.query<JoinedPurchaseRow>(this.detailsQuery, [id]);
    return mapPurchaseDetails(result.rows);
  }

  async findByIdForUpdate(client: PoolClient, id: string): Promise<PurchaseDetails | null> {
    const result = await client.query<JoinedPurchaseRow>(`${this.detailsQuery} FOR UPDATE OF p`, [id]);
    return mapPurchaseDetails(result.rows);
  }

  async findByIdWithClient(client: PoolClient, id: string): Promise<PurchaseDetails | null> {
    const result = await client.query<JoinedPurchaseRow>(this.detailsQuery, [id]);
    return mapPurchaseDetails(result.rows);
  }

  async getActiveProductSnapshots(
    client: PoolClient,
    productIds: readonly string[],
  ): Promise<Map<string, PurchaseProductSnapshot>> {
    const uniqueIds = [...new Set(productIds)].sort();
    const result = await client.query<ProductRow>(
      `SELECT id,
              name,
              sku,
              unit,
              is_active AS "isActive"
       FROM bazariya.products
       WHERE id = ANY($1::uuid[])
       ORDER BY id
       FOR SHARE`,
      [uniqueIds],
    );
    const products = new Map<string, PurchaseProductSnapshot>();
    for (const row of result.rows) {
      if (!row.isActive) {
        throw new PurchaseDomainError('PRODUCT_NOT_AVAILABLE', 'محصول غیرفعال را نمی‌توان به خرید جدید افزود.', 409, [
          { field: 'items', message: `محصول «${row.name}» غیرفعال است.` },
        ]);
      }
      if (!unitValues.has(row.unit)) throw new Error('Stored product unit is invalid.');
      products.set(row.id, { id: row.id, name: row.name, sku: row.sku, unit: row.unit as ProductUnit });
    }
    const missing = uniqueIds.find((id) => !products.has(id));
    if (missing) {
      throw new PurchaseDomainError('PRODUCT_NOT_FOUND', 'یکی از محصولات خرید پیدا نشد.', 404, [
        { field: 'items', message: 'همهٔ محصولات انتخاب‌شده باید وجود داشته باشند.' },
      ]);
    }
    return products;
  }

  async createDraftWithClient(client: PoolClient, values: PurchaseWriteValues): Promise<PurchaseDetails> {
    const sequence = await client.query<SequenceRow>("SELECT nextval('bazariya.purchase_number_seq')::text AS value");
    const sequenceValue = sequence.rows[0]?.value;
    if (!sequenceValue || !/^\d{1,19}$/.test(sequenceValue)) throw new Error('Purchase number sequence is invalid.');
    const purchaseNumber = `PUR-${sequenceValue.padStart(6, '0')}`;
    const inserted = await client.query<{ id: string } & QueryResultRow>(
      `INSERT INTO bazariya.purchases (
         purchase_number, supplier_id, status, subtotal, discount, total, note
       ) VALUES ($1, $2, 'draft', $3, $4, $5, $6)
       RETURNING id`,
      [purchaseNumber, values.supplierId, values.subtotal, values.discount, values.total, values.note],
    );
    const id = inserted.rows[0]?.id;
    if (!id) throw new Error('Purchase insert did not return an id.');
    await this.replaceItemsWithClient(client, id, values.items);
    const details = await this.findByIdWithClient(client, id);
    if (!details) throw new Error('Purchase details were not returned.');
    return details;
  }

  async updateDraftWithClient(client: PoolClient, id: string, values: PurchaseWriteValues): Promise<PurchaseDetails> {
    await client.query('DELETE FROM bazariya.purchase_items WHERE purchase_id = $1', [id]);
    await this.replaceItemsWithClient(client, id, values.items);
    const updated = await client.query(
      `UPDATE bazariya.purchases
       SET supplier_id = $2, subtotal = $3, discount = $4, total = $5, note = $6, updated_at = now()
       WHERE id = $1`,
      [id, values.supplierId, values.subtotal, values.discount, values.total, values.note],
    );
    if (updated.rowCount !== 1) throw new Error('Draft purchase update did not affect one row.');
    const details = await this.findByIdWithClient(client, id);
    if (!details) throw new Error('Updated purchase details were not returned.');
    return details;
  }

  async setStatusWithClient(
    client: PoolClient,
    id: string,
    status: 'confirmed' | 'cancelled',
  ): Promise<PurchaseDetails> {
    const updated = await client.query(
      `UPDATE bazariya.purchases
       SET status = $2, updated_at = now()
       WHERE id = $1`,
      [id, status],
    );
    if (updated.rowCount !== 1) throw new Error('Purchase status update did not affect one row.');
    const details = await this.findByIdWithClient(client, id);
    if (!details) throw new Error('Updated purchase details were not returned.');
    return details;
  }

  private async replaceItemsWithClient(client: PoolClient, purchaseId: string, items: readonly PurchaseLineRecord[]): Promise<void> {
    if (items.length === 0) throw new Error('A Purchase must contain at least one item.');
    const result = await client.query(
      `INSERT INTO bazariya.purchase_items (
         purchase_id,
         product_id,
         product_name_snapshot,
         product_sku_snapshot,
         unit_snapshot,
         unit_price,
         quantity,
         line_total
       )
       SELECT $1, input.product_id, input.product_name, input.product_sku,
              input.unit_snapshot, input.unit_price, input.quantity, input.line_total
       FROM unnest(
         $2::uuid[],
         $3::varchar[],
         $4::varchar[],
         $5::varchar[],
         $6::bigint[],
         $7::bigint[],
         $8::bigint[]
       ) AS input(product_id, product_name, product_sku, unit_snapshot, unit_price, quantity, line_total)`,
      [
        purchaseId,
        items.map((item) => item.id),
        items.map((item) => item.name),
        items.map((item) => item.sku),
        items.map((item) => item.unit),
        items.map((item) => item.unitPrice),
        items.map((item) => item.quantity),
        items.map((item) => item.lineTotal),
      ],
    );
    if (result.rowCount !== items.length) throw new Error('Purchase item insert count did not match input.');
  }

  private get detailsQuery(): string {
    return `SELECT ${purchaseColumns},
                   s.name AS "supplierName",
                   s.phone AS "supplierPhone",
                   s.email AS "supplierEmail",
                   s.is_active AS "supplierIsActive",
                   pi.id AS "itemId",
                   pi.product_id AS "productId",
                   pi.product_name_snapshot AS "productNameSnapshot",
                   pi.product_sku_snapshot AS "productSkuSnapshot",
                   pi.unit_snapshot AS "unitSnapshot",
                   pi.unit_price::text AS "unitPrice",
                   pi.quantity::text AS quantity,
                   pi.line_total::text AS "lineTotal"
            FROM bazariya.purchases p
            JOIN bazariya.suppliers s ON s.id = p.supplier_id
            LEFT JOIN bazariya.purchase_items pi ON pi.purchase_id = p.id
            WHERE p.id = $1
            ORDER BY lower(pi.product_name_snapshot), pi.product_sku_snapshot, pi.id`;
  }
}
