import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../db/database.service';
import { AuditService } from '../audit/audit.service';
import { PasswordResetService } from '../auth/password-reset.service';
import { normalizeIranianMobile } from '../auth/phone';
import { AppError, isUniqueViolation } from '../common/errors';
import { currentStore } from '../common/request-context';
import { assertUuid } from '../common/uuid';
import type {
  CompanyEntitlementView,
  SubscriptionSnapshot,
} from '@bazaria/shared';
import { SubscriptionService } from '../subscription/subscription.service';
import {
  addDaysToUtcDate,
  toUtcDateOnly,
} from '../subscription/subscription-policy';

export interface CreateCompanyInput {
  name: string;
  code: string;
  currency: string;
  maxStores: number;
  validUntil?: string | null;
  managerMobile: string;
  managerFullName: string;
}

export interface UpdateLicenseInput {
  status?: 'active' | 'suspended';
  maxStores?: number;
  validUntil?: string | null;
}

export interface PlatformCompanyView {
  id: string;
  name: string;
  code: string;
  status: 'active' | 'suspended';
  currency: string;
  createdAt: string;
  license: {
    status: 'active' | 'suspended';
    maxStores: number;
    validUntil: string | null;
    subscription: SubscriptionSnapshot;
  };
  activeMemberships: number;
}

export interface CreateCompanyResult {
  company: PlatformCompanyView;
  manager: {
    userId: string;
    mobile: string;
    fullName: string;
    createdUser: boolean;
    inviteToken?: string;
    inviteExpiresAt?: string;
  };
}

interface EntitlementRow {
  company_id: string;
  status: 'active' | 'suspended';
  max_stores: number;
  valid_until: string | null;
  created_at: Date;
  updated_at: Date;
  company_status: 'active' | 'suspended';
}

const ENTITLEMENT_SELECT = `SELECT e.company_id, e.status, e.max_stores,
       to_char(e.valid_until, 'YYYY-MM-DD') AS valid_until,
       e.created_at, e.updated_at, c.status AS company_status
  FROM company_entitlements e
  JOIN companies c ON c.id = e.company_id`;

@Injectable()
export class PlatformCompanyService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    private readonly passwordReset: PasswordResetService,
    private readonly subscription: SubscriptionService,
  ) {}

  async list(): Promise<PlatformCompanyView[]> {
    const result = await this.db.query<{
      id: string;
      name: string;
      code: string;
      status: 'active' | 'suspended';
      currency: string;
      created_at: Date;
      license_status: 'active' | 'suspended' | null;
      max_stores: number | null;
      valid_until: string | null;
      active_memberships: string;
    }>(
      `SELECT c.id, c.name, c.code, c.status, c.currency, c.created_at,
              e.status AS license_status, e.max_stores,
              to_char(e.valid_until, 'YYYY-MM-DD') AS valid_until,
              (SELECT count(*) FROM company_memberships m
                WHERE m.company_id = c.id AND m.status = 'active') AS active_memberships
         FROM companies c
         LEFT JOIN company_entitlements e ON e.company_id = c.id
        ORDER BY c.created_at DESC`,
    );

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      code: row.code,
      status: row.status,
      currency: row.currency,
      createdAt: row.created_at.toISOString(),
      license: {
        status: row.license_status ?? 'suspended',
        maxStores: row.max_stores ?? 0,
        validUntil: row.valid_until,
        subscription: this.subscription.evaluate(
          row.status,
          row.license_status ?? 'suspended',
          row.valid_until,
        ),
      },
      activeMemberships: Number(row.active_memberships),
    }));
  }

  async create(input: CreateCompanyInput): Promise<CreateCompanyResult> {
    const admin = currentStore().platformAdmin;
    const name = input.name.trim();
    const managerFullName = input.managerFullName.trim();
    if (name.length < 2) {
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
    if (managerFullName.length < 2) {
      throw new AppError('VALIDATION_ERROR', {
        details: [
          {
            field: 'managerFullName',
            code: 'INVALID_NAME',
            message: 'نام مدیر باید حداقل ۲ نویسه غیرفاصله باشد.',
          },
        ],
      });
    }
    const mobile = normalizeIranianMobile(input.managerMobile);
    if (!mobile) {
      throw new AppError('VALIDATION_ERROR', {
        details: [
          {
            field: 'managerMobile',
            code: 'INVALID_MOBILE',
            message: 'شماره موبایل مدیر معتبر نیست.',
          },
        ],
      });
    }

    const code = input.code.trim().toUpperCase();
    let companyId: string;
    try {
      const company = await this.db.query<{ id: string }>(
        `INSERT INTO companies (name, code, currency)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [name, code, input.currency],
      );
      companyId = company.rows[0].id;
    } catch (error) {
      if (isUniqueViolation(error, 'companies_code_key')) {
        throw new AppError('COMPANY_CODE_TAKEN');
      }
      throw error;
    }

    await this.db.query(
      `INSERT INTO company_entitlements (company_id, status, max_stores, valid_until)
       VALUES ($1, 'active', $2, $3::date)`,
      [companyId, input.maxStores, input.validUntil ?? null],
    );

    let user = await this.db.query<{
      id: string;
      password_hash: string | null;
      full_name: string;
    }>('SELECT id, password_hash, full_name FROM users WHERE mobile = $1', [mobile]);

    let createdUser = false;
    if (!user.rows[0]) {
      user = await this.db.query<{
        id: string;
        password_hash: string | null;
        full_name: string;
      }>(
        `INSERT INTO users (mobile, full_name)
         VALUES ($1, $2)
         RETURNING id, password_hash, full_name`,
        [mobile, managerFullName],
      );
      createdUser = true;
    }

    const managerUser = user.rows[0];

    await this.db.query(
      `INSERT INTO company_memberships (user_id, company_id, role_code)
       VALUES ($1, $2, 'manager')`,
      [managerUser.id, companyId],
    );

    let inviteToken: string | undefined;
    let inviteExpiresAt: string | undefined;
    if (!managerUser.password_hash) {
      const reset = await this.passwordReset.issueToken(
        managerUser.id,
        'platform_admin',
        admin?.id ?? null,
      );
      inviteToken = reset.token;
      inviteExpiresAt = reset.expiresAt.toISOString();
    }

    await this.audit.record({
      companyId,
      action: 'platform.company.created',
      entityType: 'company',
      entityId: companyId,
      details: {
        code,
        maxStores: input.maxStores,
        validUntil: input.validUntil ?? null,
        managerUserId: managerUser.id,
        createdUser,
        inviteIssued: Boolean(inviteToken),
      },
    });

    const created = await this.db.query<{
      id: string;
      name: string;
      code: string;
      status: 'active' | 'suspended';
      currency: string;
      created_at: Date;
      license_status: 'active' | 'suspended';
      max_stores: number;
      valid_until: string | null;
      active_memberships: string;
    }>(
      `SELECT c.id, c.name, c.code, c.status, c.currency, c.created_at,
              e.status AS license_status, e.max_stores,
              to_char(e.valid_until, 'YYYY-MM-DD') AS valid_until,
              (SELECT count(*) FROM company_memberships m
                WHERE m.company_id = c.id AND m.status = 'active') AS active_memberships
         FROM companies c
         JOIN company_entitlements e ON e.company_id = c.id
        WHERE c.id = $1`,
      [companyId],
    );
    const row = created.rows[0];

    return {
      company: {
        id: row.id,
        name: row.name,
        code: row.code,
        status: row.status,
        currency: row.currency,
        createdAt: row.created_at.toISOString(),
        license: {
          status: row.license_status,
          maxStores: row.max_stores,
          validUntil: row.valid_until,
          subscription: this.subscription.evaluate(
            row.status,
            row.license_status,
            row.valid_until,
          ),
        },
        activeMemberships: Number(row.active_memberships),
      },
      manager: {
        userId: managerUser.id,
        mobile,
        fullName: managerUser.full_name,
        createdUser,
        inviteToken,
        inviteExpiresAt,
      },
    };
  }

  async updateLicense(
    companyId: string,
    input: UpdateLicenseInput,
  ): Promise<CompanyEntitlementView> {
    assertUuid(companyId);

    const company = await this.db.query<{ id: string }>(
      'SELECT id FROM companies WHERE id = $1',
      [companyId],
    );
    if (!company.rows[0]) throw new AppError('RESOURCE_NOT_FOUND');

    const before = await this.db.query<{
      status: 'active' | 'suspended';
      max_stores: number;
      valid_until: string | null;
    }>(
      `SELECT status, max_stores, to_char(valid_until, 'YYYY-MM-DD') AS valid_until
         FROM company_entitlements WHERE company_id = $1`,
      [companyId],
    );
    const current = before.rows[0];
    if (!current) throw new AppError('RESOURCE_NOT_FOUND');

    const validUntilProvided = input.validUntil !== undefined;

    await this.db.query(
      `UPDATE company_entitlements
          SET status = coalesce($1, status),
              max_stores = coalesce($2, max_stores),
              valid_until = CASE WHEN $3 THEN $4::date ELSE valid_until END
        WHERE company_id = $5`,
      [
        input.status ?? null,
        input.maxStores ?? null,
        validUntilProvided,
        validUntilProvided ? (input.validUntil ?? null) : null,
        companyId,
      ],
    );

    await this.audit.record({
      companyId,
      action: 'platform.license.updated',
      entityType: 'company_entitlement',
      entityId: companyId,
      details: {
        before: current,
        after: {
          status: input.status ?? current.status,
          maxStores: input.maxStores ?? current.max_stores,
          validUntil: validUntilProvided ? (input.validUntil ?? null) : current.valid_until,
        },
      },
    });

    const updated = await this.db.query<EntitlementRow>(
      `${ENTITLEMENT_SELECT} WHERE e.company_id = $1`,
      [companyId],
    );
    return this.toEntitlementView(updated.rows[0]);
  }

  /**
   * Explicit renewal: extends from the later of today and the current expiry,
   * keeps the entitlement active and restores write access after the grace
   * window. A suspended entitlement must be reactivated explicitly first.
   */
  async renewLicense(
    companyId: string,
    days: number,
  ): Promise<CompanyEntitlementView> {
    assertUuid(companyId);
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      throw new AppError('VALIDATION_ERROR', {
        details: [
          {
            field: 'days',
            code: 'INVALID_DURATION',
            message: 'مدت تمدید باید بین ۱ تا ۳۶۵۰ روز باشد.',
          },
        ],
      });
    }

    const before = await this.db.query<EntitlementRow>(
      `${ENTITLEMENT_SELECT} WHERE e.company_id = $1 FOR UPDATE OF e`,
      [companyId],
    );
    const current = before.rows[0];
    if (!current) throw new AppError('RESOURCE_NOT_FOUND');
    if (current.status !== 'active') {
      throw new AppError('STATE_CONFLICT', {
        message:
          'مجوز تعلیق‌شده را ابتدا از مسیر تغییر مجوز فعال کنید و سپس تمدید کنید.',
      });
    }
    if (!current.valid_until) {
      throw new AppError('STATE_CONFLICT', {
        message: 'این مجوز تاریخ انقضا ندارد و نیازمند تمدید نیست.',
      });
    }

    const today = toUtcDateOnly(new Date());
    const base = current.valid_until > today ? current.valid_until : today;
    const nextValidUntil = addDaysToUtcDate(base, days);
    if (!nextValidUntil) {
      throw new AppError('VALIDATION_ERROR', {
        details: [
          {
            field: 'days',
            code: 'INVALID_DURATION',
            message: 'تاریخ تمدید معتبر نیست.',
          },
        ],
      });
    }

    await this.db.query(
      `UPDATE company_entitlements SET valid_until = $1::date
        WHERE company_id = $2`,
      [nextValidUntil, companyId],
    );

    await this.audit.record({
      companyId,
      action: 'platform.license.renewed',
      entityType: 'company_entitlement',
      entityId: companyId,
      details: {
        before: { validUntil: current.valid_until },
        after: { validUntil: nextValidUntil },
        days,
      },
    });

    const updated = await this.db.query<EntitlementRow>(
      `${ENTITLEMENT_SELECT} WHERE e.company_id = $1`,
      [companyId],
    );
    return this.toEntitlementView(updated.rows[0]);
  }

  private toEntitlementView(row: EntitlementRow): CompanyEntitlementView {
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
