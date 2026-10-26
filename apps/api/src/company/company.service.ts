import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../db/database.service';
import { AuditService } from '../audit/audit.service';
import { AppError } from '../common/errors';
import { currentStore } from '../common/request-context';
import {
  ROLE_PERMISSIONS,
  type CompanyEntitlementView,
  type Permission,
  type RoleCode,
  type StoreUsage,
  type SubscriptionSnapshot,
} from '@bazaria/shared';
import { SubscriptionService } from '../subscription/subscription.service';

export interface CompanyView {
  id: string;
  name: string;
  code: string;
  status: 'active' | 'suspended';
  currency: string;
  role: RoleCode;
  permissions: readonly Permission[];
  subscription: SubscriptionSnapshot;
  storeUsage: StoreUsage;
}

export interface UpdateCompanyInput {
  name?: string;
  currency?: string;
}

@Injectable()
export class CompanyService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    private readonly subscription: SubscriptionService,
  ) {}

  async getCurrent(): Promise<CompanyView> {
    const store = currentStore();
    if (!store.companyId || !store.role) throw new AppError('COMPANY_CONTEXT_REQUIRED');

    const result = await this.db.query<{
      id: string;
      name: string;
      code: string;
      status: 'active' | 'suspended';
      currency: string;
      license_status: 'active' | 'suspended' | null;
      valid_until: string | null;
      max_stores: number | null;
      active_stores: string;
    }>(
      `SELECT c.id, c.name, c.code, c.status, c.currency,
              e.status AS license_status, e.max_stores,
              to_char(e.valid_until, 'YYYY-MM-DD') AS valid_until,
              (SELECT count(*) FROM stores s
                WHERE s.company_id = c.id AND s.status = 'active') AS active_stores
         FROM companies c
         LEFT JOIN company_entitlements e ON e.company_id = c.id
        WHERE c.id = $1`,
      [store.companyId],
    );
    const row = result.rows[0];
    if (!row) throw new AppError('RESOURCE_NOT_FOUND');
    if (!row.license_status) throw new AppError('LICENSE_INACTIVE');

    return {
      id: row.id,
      name: row.name,
      code: row.code,
      status: row.status,
      currency: row.currency,
      role: store.role,
      permissions: ROLE_PERMISSIONS[store.role],
      subscription: this.subscription.evaluate(
        row.status,
        row.license_status,
        row.valid_until,
      ),
      storeUsage: {
        active: Number(row.active_stores),
        limit: row.max_stores ?? 0,
      },
    };
  }

  async update(input: UpdateCompanyInput): Promise<CompanyView> {
    const store = currentStore();
    if (!store.companyId) throw new AppError('COMPANY_CONTEXT_REQUIRED');

    const name = input.name?.trim();
    if (name !== undefined && name.length < 2) {
      throw new AppError('VALIDATION_ERROR', {
        details: [
          {
            field: 'name',
            code: 'INVALID_NAME',
            message: 'نام شرکت باید حداقل ۲ نویسه غیرفاصله باشد.',
          },
        ],
      });
    }

    const before = await this.db.query<{
      name: string;
      currency: string;
    }>('SELECT name, currency FROM companies WHERE id = $1', [store.companyId]);
    const current = before.rows[0];
    if (!current) throw new AppError('RESOURCE_NOT_FOUND');

    if (name === undefined && input.currency === undefined) {
      return this.getCurrent();
    }

    await this.db.query(
      `UPDATE companies
          SET name = coalesce($1, name),
              currency = coalesce($2, currency)
        WHERE id = $3`,
      [name ?? null, input.currency ?? null, store.companyId],
    );

    await this.audit.record({
      companyId: store.companyId,
      action: 'company.updated',
      entityType: 'company',
      entityId: store.companyId,
      details: {
        before: { name: current.name, currency: current.currency },
        after: {
          name: name ?? current.name,
          currency: input.currency ?? current.currency,
        },
        changedFields: Object.keys(input).filter(
          (key) => input[key as keyof UpdateCompanyInput] !== undefined,
        ),
      },
    });

    return this.getCurrent();
  }

  async getLicense(): Promise<CompanyEntitlementView> {
    const store = currentStore();
    if (!store.companyId) throw new AppError('COMPANY_CONTEXT_REQUIRED');
    const result = await this.db.query<{
      company_id: string;
      status: 'active' | 'suspended';
      max_stores: number;
      valid_until: string | null;
      created_at: Date;
      updated_at: Date;
      company_status: 'active' | 'suspended';
    }>(
      `SELECT e.company_id, e.status, e.max_stores,
              to_char(e.valid_until, 'YYYY-MM-DD') AS valid_until,
              e.created_at, e.updated_at, c.status AS company_status
         FROM company_entitlements e
         JOIN companies c ON c.id = e.company_id
        WHERE e.company_id = $1`,
      [store.companyId],
    );
    const row = result.rows[0];
    if (!row) throw new AppError('RESOURCE_NOT_FOUND');
    return {
      companyId: row.company_id,
      status: row.status,
      maxStores: row.max_stores,
      validUntil: row.valid_until,
      subscription: this.subscription.evaluate(
        row.company_status,
        row.status,
        row.valid_until,
      ),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}
