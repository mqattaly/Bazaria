import { Injectable } from '@nestjs/common';
import type { Category, CategoryListItem, CreateCategoryInput, UpdateCategoryInput } from '@bazariya/shared';
import type { QueryResultRow } from 'pg';
import { DatabaseService } from '../../database/database.service.js';

interface CategoryRow extends QueryResultRow {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface CategoryListRow extends CategoryRow {
  productCount: number | string;
}

const categoryFields = `
  id,
  name,
  description,
  is_active AS "isActive",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toSafeCount(value: number | string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error('Stored category product count is outside the safe integer range.');
  }
  return parsed;
}

function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isActive: row.isActive,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

@Injectable()
export class CategoriesRepository {
  constructor(private readonly database: DatabaseService) {}

  async list(): Promise<CategoryListItem[]> {
    const result = await this.database.query<CategoryListRow>(`
      SELECT
        c.id,
        c.name,
        c.description,
        c.is_active AS "isActive",
        c.created_at AS "createdAt",
        c.updated_at AS "updatedAt",
        count(p.id)::bigint AS "productCount"
      FROM bazariya.categories AS c
      LEFT JOIN bazariya.products AS p ON p.category_id = c.id
      GROUP BY c.id
      ORDER BY lower(c.name), c.id
    `);

    return result.rows.map((row) => ({ ...mapCategory(row), productCount: toSafeCount(row.productCount) }));
  }

  async findById(id: string): Promise<Category | null> {
    const result = await this.database.query<CategoryRow>(
      `SELECT ${categoryFields} FROM bazariya.categories WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    return row ? mapCategory(row) : null;
  }

  async exists(id: string): Promise<boolean> {
    const result = await this.database.query<{ found: boolean } & QueryResultRow>(
      'SELECT true AS found FROM bazariya.categories WHERE id = $1',
      [id],
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  async create(input: CreateCategoryInput): Promise<Category> {
    const result = await this.database.query<CategoryRow>(
      `INSERT INTO bazariya.categories (name, description, is_active)
       VALUES ($1, $2, $3)
       RETURNING ${categoryFields}`,
      [input.name, input.description ?? null, input.isActive ?? true],
    );
    return mapCategory(result.rows[0]!);
  }

  async update(id: string, input: UpdateCategoryInput): Promise<Category | null> {
    const values: unknown[] = [id];
    const updates: string[] = [];
    const fields: Array<[keyof UpdateCategoryInput, string]> = [
      ['name', 'name'],
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

    const result = await this.database.query<CategoryRow>(
      `UPDATE bazariya.categories SET ${updates.join(', ')} WHERE id = $1 RETURNING ${categoryFields}`,
      values,
    );
    const row = result.rows[0];
    return row ? mapCategory(row) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.database.query<{ id: string } & QueryResultRow>(
      'DELETE FROM bazariya.categories WHERE id = $1 RETURNING id',
      [id],
    );
    return result.rowCount !== null && result.rowCount > 0;
  }
}
