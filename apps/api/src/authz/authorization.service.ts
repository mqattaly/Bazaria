import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../db/database.service';
import { AppError } from '../common/errors';
import { SecurityEventService } from '../common/security-event.service';
import { setCompanyContext } from '../db/tenant-context';
import {
  hasPermission,
  type Permission,
  type RoleCode,
  type SubscriptionSnapshot,
} from '@bazaria/shared';
import { SubscriptionService } from '../subscription/subscription.service';

export interface CompanyAccess {
  companyId: string;
  role: RoleCode;
  companyStatus: 'active' | 'suspended';
  subscription: SubscriptionSnapshot;
}

/**
 * Central authorization for company-scoped requests. The client-supplied
 * X-Company-Id is only a claim; membership, company status and entitlement are
 * verified against the database before any domain query runs.
 */
@Injectable()
export class AuthorizationService {
  constructor(
    private readonly db: DatabaseService,
    private readonly security: SecurityEventService,
    private readonly subscription: SubscriptionService,
  ) {}

  async establishCompanyContext(
    client: PoolClient,
    userId: string,
    claimedCompanyId: string,
  ): Promise<CompanyAccess> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claimedCompanyId)) {
      await this.security.recordStandalone('authz.invalid_company_id', { userId });
      throw new AppError('COMPANY_ACCESS_DENIED');
    }

    const membership = await this.db.query<{
      id: string;
      role_code: RoleCode;
      status: string;
    }>(
      `SELECT id, role_code, status
         FROM company_memberships
        WHERE user_id = $1 AND company_id = $2`,
      [userId, claimedCompanyId],
    );
    const row = membership.rows[0];

    if (!row || row.status !== 'active') {
      await this.security.recordStandalone('authz.company_access_denied', {
        userId,
        claimedCompanyId,
      });
      throw new AppError('COMPANY_ACCESS_DENIED');
    }

    // Only after membership is proven do we set the RLS company context.
    await setCompanyContext(client, claimedCompanyId);

    const company = await this.db.query<{ status: string }>(
      'SELECT status FROM companies WHERE id = $1',
      [claimedCompanyId],
    );
    const companyRow = company.rows[0];
    if (!companyRow) {
      await this.security.recordStandalone('authz.company_access_denied', {
        userId,
        claimedCompanyId,
      });
      throw new AppError('COMPANY_ACCESS_DENIED');
    }

    if (companyRow.status !== 'active') {
      throw new AppError('LICENSE_INACTIVE');
    }

    const entitlement = await this.db.query<{
      status: string;
      valid_until: string | null;
    }>(
      `SELECT status, to_char(valid_until, 'YYYY-MM-DD') AS valid_until
         FROM company_entitlements WHERE company_id = $1`,
      [claimedCompanyId],
    );
    const entitlementRow = entitlement.rows[0];
    if (!entitlementRow || entitlementRow.status !== 'active') {
      throw new AppError('LICENSE_INACTIVE');
    }

    // Suspension is an access decision (Phase 1 behaviour). Expiry is a
    // subscription state: reads stay available, writes are blocked centrally.
    const subscription = this.subscription.evaluate(
      companyRow.status,
      entitlementRow.status,
      entitlementRow.valid_until,
    );

    return {
      companyId: claimedCompanyId,
      role: row.role_code,
      companyStatus: 'active',
      subscription,
    };
  }

  async assertPermission(
    userId: string,
    companyId: string,
    role: RoleCode,
    permission: Permission,
  ): Promise<void> {
    if (!hasPermission(role, permission)) {
      await this.security.recordStandalone('authz.permission_denied', {
        userId,
        companyId,
        permission,
      });
      throw new AppError('PERMISSION_DENIED');
    }
  }
}
