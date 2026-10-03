import { Injectable } from '@nestjs/common';
import type {
  CreateCustomerInput,
  Customer,
  CustomerListQuery,
  PaginatedData,
  UpdateCustomerInput,
} from '@bazariya/shared';
import type { QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service.js';
import { normalizePhone } from './customers.validation.js';

interface CustomerRow extends QueryResultRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface CountRow extends QueryResultRow {
  total: string | number;
}

const customerFields = `
  id,
  name,
  phone,
  email,
  address,
  description,
  is_active AS "isActive",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toSafeCount(value: string | number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error('Customer count is outside the safe integer range.');
  }
  return parsed;
}

function mapCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    description: row.description,
    isActive: row.isActive,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

@Injectable()
export class CustomersRepository {
  constructor(private readonly database: DatabaseService) {}

  async list(query: CustomerListQuery): Promise<PaginatedData<Customer>> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    const search = query.search?.trim();

    if (search) {
      const textPattern = `%${escapeLike(search.toLocaleLowerCase('en-US'))}%`;
      const normalizedPhoneSearch = normalizePhone(search);
      const phoneTerm = typeof normalizedPhoneSearch === 'string' ? normalizedPhoneSearch : search;
      const phonePattern = `%${escapeLike(phoneTerm)}%`;
      values.push(textPattern, phonePattern, textPattern);
      const nameParameter = values.length - 2;
      const phoneParameter = values.length - 1;
      const emailParameter = values.length;
      conditions.push(
        `(lower(name) LIKE $${nameParameter} ESCAPE E'\\\\' OR phone LIKE $${phoneParameter} ESCAPE E'\\\\' OR lower(email) LIKE $${emailParameter} ESCAPE E'\\\\')`,
      );
    }

    if (query.isActive !== undefined) {
      values.push(query.isActive);
      conditions.push(`is_active = $${values.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await this.database.query<CountRow>(
      `SELECT count(*)::bigint AS total FROM bazariya.customers ${where}`,
      values,
    );
    const total = toSafeCount(countResult.rows[0]?.total ?? 0);

    const offset = (query.page - 1) * query.pageSize;
    const paginationValues = [...values, query.pageSize, offset];
    const limitParameter = values.length + 1;
    const offsetParameter = values.length + 2;
    const result = await this.database.query<CustomerRow>(
      `SELECT ${customerFields}
       FROM bazariya.customers
       ${where}
       ORDER BY lower(name), id
       LIMIT $${limitParameter} OFFSET $${offsetParameter}`,
      paginationValues,
    );

    return {
      items: result.rows.map(mapCustomer),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async findById(id: string): Promise<Customer | null> {
    const result = await this.database.query<CustomerRow>(
      `SELECT ${customerFields} FROM bazariya.customers WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    return row ? mapCustomer(row) : null;
  }

  async create(input: CreateCustomerInput): Promise<Customer> {
    const result = await this.database.query<CustomerRow>(
      `INSERT INTO bazariya.customers (
         name, phone, email, address, description, is_active
       ) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${customerFields}`,
      [
        input.name,
        input.phone ?? null,
        input.email ?? null,
        input.address ?? null,
        input.description ?? null,
        input.isActive ?? true,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Customer insert did not return a row.');
    return mapCustomer(row);
  }

  async update(id: string, input: UpdateCustomerInput): Promise<Customer | null> {
    const values: unknown[] = [id];
    const updates: string[] = [];
    const fields: Array<[keyof UpdateCustomerInput, string]> = [
      ['name', 'name'],
      ['phone', 'phone'],
      ['email', 'email'],
      ['address', 'address'],
      ['description', 'description'],
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

    const result = await this.database.query<CustomerRow>(
      `UPDATE bazariya.customers SET ${updates.join(', ')} WHERE id = $1 RETURNING ${customerFields}`,
      values,
    );
    const row = result.rows[0];
    return row ? mapCustomer(row) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.database.query<{ id: string } & QueryResultRow>(
      'DELETE FROM bazariya.customers WHERE id = $1 RETURNING id',
      [id],
    );
    return result.rowCount !== null && result.rowCount > 0;
  }
}
