import { Injectable } from '@nestjs/common';
import {
  STORE_SORT_FIELDS,
  type PageMeta,
  type StoreSort,
  type StoreStatus,
  type StoreView,
} from '@bazaria/shared';
import { DatabaseService } from '../db/database.service';
import { AuditService } from '../audit/audit.service';
import { AppError } from '../common/errors';
import { currentStore } from '../common/request-context';
import { assertUuid } from '../common/uuid';
import { normalizeIranianMobile } from '../auth/phone';
import type {
  CreateStoreDto,
  ListStoresQueryDto,
  UpdateStoreDto,
} from './store.dto';

interface StoreRow {
  id: string;
  name: string;
  contact_name: string | null;
  contact_mobile: string | null;
  address: string | null;
  note: string | null;
  status: StoreStatus;
  created_by_user_id: string | null;
  updated_by_user_id: string | null;
  created_at: Date;
  updated_at: Date;
}

const STORE_SELECT = `SELECT id, name, contact_name, contact_mobile, address, note,
       status, created_by_user_id, updated_by_user_id, created_at, updated_at
  FROM stores`;

const SORT_COLUMNS: Record<Exclude<StoreSort, `-${string}`>, string> = {
  createdAt: 'created_at',
  name: 'name',
  updatedAt: 'updated_at',
};

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function validationError(field: string, code: string, message: string): never {
  throw new AppError('VALIDATION_ERROR', {
    details: [{ field, code, message }],
  });
}

function trimmedOrNull(
  value: string | null | undefined,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

@Injectable()
export class StoreService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  async list(input: ListStoresQueryDto): Promise<{
    data: StoreView[];
    meta: PageMeta;
  }> {
    const { companyId } = this.requireContext();
    const page = input.page ?? 1;
    const pageSize = input.pageSize ?? 20;
    const sort: StoreSort = input.sort ?? '-createdAt';
    const q = input.q?.trim() ?? '';

    if (q.length > 80) {
      validationError('q', 'SEARCH_TOO_LONG', 'عبارت جست‌وجو بیش از حد طولانی است.');
    }

    const where: string[] = ['company_id = $1'];
    const params: unknown[] = [companyId];

    if (input.status) {
      params.push(input.status);
      where.push(`status = $${params.length}`);
    }

    if (q) {
      const like = `%${escapeLike(q)}%`;
      params.push(like);
      const likeParam = `$${params.length}`;
      const clauses = [
        `name ILIKE ${likeParam} ESCAPE '\\'`,
        `coalesce(contact_name, '') ILIKE ${likeParam} ESCAPE '\\'`,
        `coalesce(address, '') ILIKE ${likeParam} ESCAPE '\\'`,
        `coalesce(contact_mobile, '') ILIKE ${likeParam} ESCAPE '\\'`,
      ];
      const normalizedMobile = normalizeIranianMobile(q);
      if (normalizedMobile) {
        params.push(`%${normalizedMobile}%`);
        clauses.push(`contact_mobile ILIKE $${params.length} ESCAPE '\\'`);
      }
      where.push(`(${clauses.join(' OR ')})`);
    }

    const whereSql = where.join(' AND ');
    const count = await this.db.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM stores WHERE ${whereSql}`,
      params,
    );
    const totalItems = count.rows[0]?.total ?? 0;
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);

    const descending = sort.startsWith('-');
    const sortKey = (descending ? sort.slice(1) : sort) as keyof typeof SORT_COLUMNS;
    if (!STORE_SORT_FIELDS.includes(sort) || !SORT_COLUMNS[sortKey]) {
      validationError('sort', 'INVALID_SORT', 'مرتب‌سازی درخواستی معتبر نیست.');
    }
    const direction = descending ? 'DESC' : 'ASC';

    const listParams = [...params, pageSize, (page - 1) * pageSize];
    const rows = await this.db.query<StoreRow>(
      `${STORE_SELECT}
        WHERE ${whereSql}
        ORDER BY ${SORT_COLUMNS[sortKey]} ${direction}, id ${direction}
        LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams,
    );

    return {
      data: rows.rows.map((row) => this.toView(row)),
      meta: { page, pageSize, totalItems, totalPages },
    };
  }

  async get(storeId: string): Promise<StoreView> {
    const { companyId } = this.requireContext();
    assertUuid(storeId);
    const result = await this.db.query<StoreRow>(
      `${STORE_SELECT} WHERE id = $1 AND company_id = $2`,
      [storeId, companyId],
    );
    const row = result.rows[0];
    if (!row) throw new AppError('RESOURCE_NOT_FOUND');
    return this.toView(row);
  }

  async create(input: CreateStoreDto): Promise<StoreView> {
    const { companyId, userId } = this.requireContext();
    const name = this.requireName(input.name);
    const contactName = this.normalizeContactName(input.contactName);
    const contactMobile = this.normalizeContactMobile(input.contactMobile);
    const address = this.normalizeAddress(input.address);
    const note = this.normalizeNote(input.note);

    // BR-LIC-002: the license caps active stores. New stores start active, so
    // the capacity check runs inside the same transaction and locks the
    // entitlement row to serialise concurrent creations.
    await this.assertStoreCapacity(companyId, 1);

    const result = await this.db.query<StoreRow>(
      `INSERT INTO stores
         (company_id, name, contact_name, contact_mobile, address, note,
          created_by_user_id, updated_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
       RETURNING id, name, contact_name, contact_mobile, address, note,
                 status, created_by_user_id, updated_by_user_id, created_at, updated_at`,
      [companyId, name, contactName, contactMobile, address, note, userId],
    );
    const view = this.toView(result.rows[0]);

    await this.audit.record({
      companyId,
      action: 'store.created',
      entityType: 'store',
      entityId: view.id,
      details: {
        name: view.name,
        contactName: view.contactName,
        contactMobile: view.contactMobile,
        address: view.address,
        note: view.note,
        status: view.status,
      },
    });

    return view;
  }

  async update(storeId: string, input: UpdateStoreDto): Promise<StoreView> {
    const { companyId, userId } = this.requireContext();
    assertUuid(storeId);

    const provided = Object.entries(input).filter(
      ([, value]) => value !== undefined,
    );
    if (provided.length === 0) {
      validationError('body', 'EMPTY_UPDATE', 'حداقل یک فیلد برای ویرایش لازم است.');
    }

    const current = await this.db.query<StoreRow>(
      `${STORE_SELECT} WHERE id = $1 AND company_id = $2`,
      [storeId, companyId],
    );
    const before = current.rows[0];
    if (!before) throw new AppError('RESOURCE_NOT_FOUND');

    const assignments: string[] = [];
    const params: unknown[] = [];

    const set = (column: string, value: unknown): void => {
      params.push(value);
      assignments.push(`${column} = $${params.length}`);
    };

    if (input.name !== undefined) set('name', this.requireName(input.name));
    if (input.contactName !== undefined) {
      set('contact_name', this.normalizeContactName(input.contactName));
    }
    if (input.contactMobile !== undefined) {
      set('contact_mobile', this.normalizeContactMobile(input.contactMobile));
    }
    if (input.address !== undefined) {
      set('address', this.normalizeAddress(input.address));
    }
    if (input.note !== undefined) set('note', this.normalizeNote(input.note));
    set('updated_by_user_id', userId);

    params.push(storeId, companyId);
    const updated = await this.db.query<StoreRow>(
      `UPDATE stores
          SET ${assignments.join(', ')}
        WHERE id = $${params.length - 1} AND company_id = $${params.length}
        RETURNING id, name, contact_name, contact_mobile, address, note,
                  status, created_by_user_id, updated_by_user_id, created_at, updated_at`,
      params,
    );
    const after = updated.rows[0];
    const view = this.toView(after);

    await this.audit.record({
      companyId,
      action: 'store.updated',
      entityType: 'store',
      entityId: view.id,
      details: {
        before: this.auditFields(before),
        after: this.auditFields(after),
        changedFields: provided.map(([key]) => key),
      },
    });

    return view;
  }

  async updateStatus(
    storeId: string,
    status: StoreStatus,
  ): Promise<StoreView> {
    const { companyId, userId } = this.requireContext();
    assertUuid(storeId);

    const current = await this.db.query<StoreRow>(
      `${STORE_SELECT} WHERE id = $1 AND company_id = $2`,
      [storeId, companyId],
    );
    const before = current.rows[0];
    if (!before) throw new AppError('RESOURCE_NOT_FOUND');
    if (before.status === status) return this.toView(before);

    // Reactivating a store consumes license capacity again.
    if (status === 'active') {
      await this.assertStoreCapacity(companyId, 1);
    }

    const updated = await this.db.query<StoreRow>(
      `UPDATE stores
          SET status = $1, updated_by_user_id = $2
        WHERE id = $3 AND company_id = $4
        RETURNING id, name, contact_name, contact_mobile, address, note,
                  status, created_by_user_id, updated_by_user_id, created_at, updated_at`,
      [status, userId, storeId, companyId],
    );
    const view = this.toView(updated.rows[0]);

    await this.audit.record({
      companyId,
      action: 'store.status_changed',
      entityType: 'store',
      entityId: view.id,
      details: {
        before: { status: before.status },
        after: { status: view.status },
      },
    });

    return view;
  }

  /**
   * Counts active stores against `company_entitlements.max_stores`. Existing
   * data is never deleted or deactivated when the license shrinks; only new
   * active stores are refused (BR-LIC-002, BR-LIC-003).
   */
  private async assertStoreCapacity(
    companyId: string,
    additionalActive: number,
  ): Promise<void> {
    // The entitlement table is read-only for tenants (RLS), so the tenant's
    // company row is the lock that serialises concurrent store creations.
    const company = await this.db.query<{ id: string }>(
      'SELECT id FROM companies WHERE id = $1 FOR UPDATE',
      [companyId],
    );
    if (!company.rows[0]) throw new AppError('COMPANY_ACCESS_DENIED');

    const entitlement = await this.db.query<{ max_stores: number }>(
      'SELECT max_stores FROM company_entitlements WHERE company_id = $1',
      [companyId],
    );
    const limit = entitlement.rows[0]?.max_stores;
    if (limit === undefined) throw new AppError('LICENSE_INACTIVE');

    const count = await this.db.query<{ active: number }>(
      `SELECT count(*)::int AS active FROM stores
        WHERE company_id = $1 AND status = 'active'`,
      [companyId],
    );
    const active = count.rows[0]?.active ?? 0;

    if (active + additionalActive > limit) {
      throw new AppError('LICENSE_STORE_LIMIT_REACHED', {
        details: [
          {
            field: 'stores',
            code: 'STORE_LIMIT_REACHED',
            message: `سقف فروشگاه‌های فعال این شرکت ${limit.toLocaleString('fa-IR')} فروشگاه است و ظرفیت خالی وجود ندارد.`,
          },
        ],
        meta: { limit, active },
      });
    }
  }

  private requireContext(): { companyId: string; userId: string } {
    const store = currentStore();
    if (!store.companyId || !store.user) {
      throw new AppError('COMPANY_CONTEXT_REQUIRED');
    }
    return { companyId: store.companyId, userId: store.user.id };
  }

  private requireName(value: string | null | undefined): string {
    if (typeof value !== 'string') {
      validationError('name', 'INVALID_NAME', 'نام فروشگاه الزامی است.');
    }
    const name = value.trim();
    if (name.length < 2 || name.length > 160) {
      validationError(
        'name',
        'INVALID_NAME',
        'نام فروشگاه باید بین ۲ تا ۱۶۰ نویسه باشد.',
      );
    }
    return name;
  }

  private normalizeContactName(
    value: string | null | undefined,
  ): string | null | undefined {
    const normalized = trimmedOrNull(value);
    if (normalized === undefined || normalized === null) return normalized;
    if (normalized.length < 2 || normalized.length > 120) {
      validationError(
        'contactName',
        'INVALID_CONTACT_NAME',
        'نام مسئول باید بین ۲ تا ۱۲۰ نویسه باشد.',
      );
    }
    return normalized;
  }

  private normalizeContactMobile(
    value: string | null | undefined,
  ): string | null | undefined {
    const normalized = trimmedOrNull(value);
    if (normalized === undefined || normalized === null) return normalized;
    const mobile = normalizeIranianMobile(normalized);
    if (!mobile) {
      validationError(
        'contactMobile',
        'INVALID_MOBILE',
        'شماره موبایل تماس معتبر نیست.',
      );
    }
    return mobile;
  }

  private normalizeAddress(
    value: string | null | undefined,
  ): string | null | undefined {
    const normalized = trimmedOrNull(value);
    if (normalized === undefined || normalized === null) return normalized;
    if (normalized.length > 500) {
      validationError(
        'address',
        'ADDRESS_TOO_LONG',
        'نشانی نباید بیش از ۵۰۰ نویسه باشد.',
      );
    }
    return normalized;
  }

  private normalizeNote(
    value: string | null | undefined,
  ): string | null | undefined {
    const normalized = trimmedOrNull(value);
    if (normalized === undefined || normalized === null) return normalized;
    if (normalized.length > 1000) {
      validationError(
        'note',
        'NOTE_TOO_LONG',
        'یادداشت نباید بیش از ۱۰۰۰ نویسه باشد.',
      );
    }
    return normalized;
  }

  private auditFields(row: StoreRow): Record<string, unknown> {
    return {
      name: row.name,
      contactName: row.contact_name,
      contactMobile: row.contact_mobile,
      address: row.address,
      note: row.note,
      status: row.status,
    };
  }

  private toView(row: StoreRow): StoreView {
    return {
      id: row.id,
      name: row.name,
      contactName: row.contact_name,
      contactMobile: row.contact_mobile,
      address: row.address,
      note: row.note,
      status: row.status,
      createdByUserId: row.created_by_user_id,
      updatedByUserId: row.updated_by_user_id,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}
