import { Injectable } from '@nestjs/common';
import type {
  CreateSupplierInput,
  PaginatedData,
  Supplier,
  SupplierListQuery,
  UpdateSupplierInput,
} from '@bazariya/shared';
import type { PoolClient, QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service.js';

interface SupplierRow extends QueryResultRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  note: string | null;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface CountRow extends QueryResultRow {
  total: string | number;
}

const supplierFields = `
  id,
  name,
  phone,
  email,
  address,
  note,
  is_active AS "isActive",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

function toIsoString(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Stored supplier timestamp is invalid.');
  return date.toISOString();
}

function toSafeCount(value: string | number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error('Supplier count is outside the safe integer range.');
  return parsed;
}

function mapSupplier(row: SupplierRow): Supplier {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    note: row.note,
    isActive: row.isActive,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

@Injectable()
export class SuppliersRepository {
  constructor(private readonly database: DatabaseService) {}

  async list(query: SupplierListQuery): Promise<PaginatedData<Supplier>> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    const search = query.search?.trim();
    if (search) {
      values.push(`%${escapeLike(search)}%`);
      const parameter = values.length;
      conditions.push(`(
        lower(name) LIKE lower($${parameter}) ESCAPE E'\\\\'
        OR COALESCE(phone, '') ILIKE $${parameter} ESCAPE E'\\\\'
        OR COALESCE(email, '') ILIKE $${parameter} ESCAPE E'\\\\'
      )`);
    }
    if (query.status) {
      values.push(query.status === 'active');
      conditions.push(`is_active = $${values.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await this.database.query<CountRow>(
      `SELECT count(*)::bigint AS total FROM bazariya.suppliers ${where}`,
      values,
    );
    const total = toSafeCount(countResult.rows[0]?.total ?? 0);
    const offset = (query.page - 1) * query.pageSize;
    const limitParameter = values.length + 1;
    const offsetParameter = values.length + 2;
    const result = await this.database.query<SupplierRow>(
      `SELECT ${supplierFields}
       FROM bazariya.suppliers
       ${where}
       ORDER BY lower(name), id
       LIMIT $${limitParameter} OFFSET $${offsetParameter}`,
      [...values, query.pageSize, offset],
    );

    return {
      items: result.rows.map(mapSupplier),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async findById(id: string): Promise<Supplier | null> {
    const result = await this.database.query<SupplierRow>(
      `SELECT ${supplierFields} FROM bazariya.suppliers WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? mapSupplier(result.rows[0]) : null;
  }

  async findForPurchase(client: PoolClient, id: string): Promise<Supplier | null> {
    const result = await client.query<SupplierRow>(
      `SELECT ${supplierFields}
       FROM bazariya.suppliers
       WHERE id = $1
       FOR SHARE`,
      [id],
    );
    return result.rows[0] ? mapSupplier(result.rows[0]) : null;
  }

  async create(input: CreateSupplierInput): Promise<Supplier> {
    const result = await this.database.query<SupplierRow>(
      `INSERT INTO bazariya.suppliers (name, phone, email, address, note, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${supplierFields}`,
      [input.name, input.phone ?? null, input.email ?? null, input.address ?? null, input.note ?? null, input.isActive ?? true],
    );
    const supplier = result.rows[0];
    if (!supplier) throw new Error('Supplier insert did not return a row.');
    return mapSupplier(supplier);
  }

  async update(id: string, input: UpdateSupplierInput): Promise<Supplier | null> {
    const fields: Array<[keyof UpdateSupplierInput, string]> = [
      ['name', 'name'],
      ['phone', 'phone'],
      ['email', 'email'],
      ['address', 'address'],
      ['note', 'note'],
    ];
    const values: unknown[] = [id];
    const updates: string[] = [];
    for (const [property, column] of fields) {
      if (input[property] === undefined) continue;
      values.push(input[property]);
      updates.push(`${column} = $${values.length}`);
    }
    if (updates.length === 0) return this.findById(id);
    updates.push('updated_at = now()');
    const result = await this.database.query<SupplierRow>(
      `UPDATE bazariya.suppliers
       SET ${updates.join(', ')}
       WHERE id = $1
       RETURNING ${supplierFields}`,
      values,
    );
    return result.rows[0] ? mapSupplier(result.rows[0]) : null;
  }

  async updateStatus(id: string, isActive: boolean): Promise<Supplier | null> {
    const result = await this.database.query<SupplierRow>(
      `UPDATE bazariya.suppliers
       SET is_active = $2, updated_at = now()
       WHERE id = $1
       RETURNING ${supplierFields}`,
      [id, isActive],
    );
    return result.rows[0] ? mapSupplier(result.rows[0]) : null;
  }

  async hasPurchaseHistory(id: string): Promise<boolean> {
    const result = await this.database.query<{ hasPurchaseHistory: boolean } & QueryResultRow>(
      `SELECT EXISTS (
         SELECT 1 FROM bazariya.purchases WHERE supplier_id = $1
       ) AS "hasPurchaseHistory"`,
      [id],
    );
    return result.rows[0]?.hasPurchaseHistory ?? false;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.database.query<{ id: string } & QueryResultRow>(
      'DELETE FROM bazariya.suppliers WHERE id = $1 RETURNING id',
      [id],
    );
    return result.rowCount !== null && result.rowCount > 0;
  }
}
