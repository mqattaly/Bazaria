import { Injectable } from '@nestjs/common';
import type {
  CreateProductInput,
  PaginatedData,
  Product,
  ProductListQuery,
  ProductUnit,
  UpdateProductInput,
} from '@bazariya/shared';
import { PRODUCT_UNITS } from '@bazariya/shared';
import type { QueryResultRow } from 'pg';
import { DatabaseService } from '../../database/database.service.js';

interface ProductRow extends QueryResultRow {
  id: string;
  name: string;
  sku: string;
  categoryId: string;
  unit: string;
  description: string | null;
  salePrice: string | number;
  purchasePrice: string | number | null;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface CountRow extends QueryResultRow {
  total: string | number;
}

const productFields = `
  id,
  name,
  sku,
  category_id AS "categoryId",
  unit,
  description,
  sale_price AS "salePrice",
  purchase_price AS "purchasePrice",
  is_active AS "isActive",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

const unitValues = new Set<string>(PRODUCT_UNITS);

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toSafePrice(value: string | number | null, field: string): number | null {
  if (value === null) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Stored ${field} is not a safe non-negative integer.`);
  }
  return parsed;
}

function mapProduct(row: ProductRow): Product {
  if (!unitValues.has(row.unit)) throw new Error('Stored product unit is invalid.');
  const salePrice = toSafePrice(row.salePrice, 'sale price');
  if (salePrice === null) throw new Error('Stored sale price is null.');

  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    categoryId: row.categoryId,
    unit: row.unit as ProductUnit,
    description: row.description,
    salePrice,
    purchasePrice: toSafePrice(row.purchasePrice, 'purchase price'),
    isActive: row.isActive,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

@Injectable()
export class ProductsRepository {
  constructor(private readonly database: DatabaseService) {}

  async list(query: ProductListQuery): Promise<PaginatedData<Product>> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    const search = query.search?.trim();

    if (search) {
      const namePattern = `${escapeLike(search.toLowerCase())}%`;
      const skuPattern = `${escapeLike(search.toUpperCase())}%`;
      values.push(namePattern, skuPattern);
      const nameParameter = values.length - 1;
      const skuParameter = values.length;
      conditions.push(
        `(lower(name) LIKE $${nameParameter} ESCAPE E'\\\\' OR sku LIKE $${skuParameter} ESCAPE E'\\\\')`,
      );
    }

    if (query.categoryId) {
      values.push(query.categoryId);
      conditions.push(`category_id = $${values.length}`);
    }
    if (query.isActive !== undefined) {
      values.push(query.isActive);
      conditions.push(`is_active = $${values.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await this.database.query<CountRow>(
      `SELECT count(*)::bigint AS total FROM bazariya.products ${where}`,
      values,
    );
    const total = Number(countResult.rows[0]?.total ?? 0);
    if (!Number.isSafeInteger(total) || total < 0) throw new Error('Product count is outside the safe integer range.');

    const offset = (query.page - 1) * query.pageSize;
    const paginationValues = [...values, query.pageSize, offset];
    const limitParameter = values.length + 1;
    const offsetParameter = values.length + 2;
    const result = await this.database.query<ProductRow>(
      `SELECT ${productFields}
       FROM bazariya.products
       ${where}
       ORDER BY lower(name), sku
       LIMIT $${limitParameter} OFFSET $${offsetParameter}`,
      paginationValues,
    );

    return {
      items: result.rows.map(mapProduct),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async findById(id: string): Promise<Product | null> {
    const result = await this.database.query<ProductRow>(
      `SELECT ${productFields} FROM bazariya.products WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    return row ? mapProduct(row) : null;
  }

  async create(input: CreateProductInput): Promise<Product> {
    const result = await this.database.query<ProductRow>(
      `INSERT INTO bazariya.products (
         name, sku, category_id, unit, description, sale_price, purchase_price, is_active
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${productFields}`,
      [
        input.name,
        input.sku,
        input.categoryId,
        input.unit,
        input.description ?? null,
        input.salePrice,
        input.purchasePrice ?? null,
        input.isActive ?? true,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Product insert did not return a row.');
    return mapProduct(row);
  }

  async update(id: string, input: UpdateProductInput): Promise<Product | null> {
    const values: unknown[] = [id];
    const updates: string[] = [];
    const fields: Array<[keyof UpdateProductInput, string]> = [
      ['name', 'name'],
      ['sku', 'sku'],
      ['categoryId', 'category_id'],
      ['unit', 'unit'],
      ['description', 'description'],
      ['salePrice', 'sale_price'],
      ['purchasePrice', 'purchase_price'],
      ['isActive', 'is_active'],
    ];

    for (const [property, column] of fields) {
      const value = input[property];
      if (value === undefined) continue;
      values.push(value);
      updates.push(`${column} = $${values.length}`);
    }

    if (updates.length === 0) return null;
    updates.push('updated_at = now()');

    const result = await this.database.query<ProductRow>(
      `UPDATE bazariya.products SET ${updates.join(', ')} WHERE id = $1 RETURNING ${productFields}`,
      values,
    );
    const row = result.rows[0];
    return row ? mapProduct(row) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.database.query<{ id: string } & QueryResultRow>(
      'DELETE FROM bazariya.products WHERE id = $1 RETURNING id',
      [id],
    );
    return result.rowCount !== null && result.rowCount > 0;
  }
}
