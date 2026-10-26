import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../db/database.service';
import { AuditService } from '../audit/audit.service';
import { PasswordResetService } from '../auth/password-reset.service';
import { normalizeIranianMobile } from '../auth/phone';
import { AppError, isUniqueViolation } from '../common/errors';
import { currentStore } from '../common/request-context';
import { assertUuid } from '../common/uuid';
import type { MembershipView, RoleCode } from '@bazaria/shared';

export interface AddMembershipInput {
  mobile: string;
  fullName: string;
  role: RoleCode;
}

export interface UpdateMembershipInput {
  role?: RoleCode;
  status?: 'active' | 'inactive';
}

export interface AddMembershipResult {
  membership: MembershipView;
  inviteToken?: string;
  inviteExpiresAt?: string;
}

@Injectable()
export class MembershipService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    private readonly passwordReset: PasswordResetService,
  ) {}

  private requireContext(): { companyId: string; userId: string } {
    const store = currentStore();
    if (!store.companyId || !store.user) {
      throw new AppError('COMPANY_CONTEXT_REQUIRED');
    }
    return { companyId: store.companyId, userId: store.user.id };
  }

  async list(): Promise<MembershipView[]> {
    const { companyId } = this.requireContext();
    const result = await this.db.query<{
      id: string;
      user_id: string;
      mobile: string;
      full_name: string;
      role_code: RoleCode;
      status: 'active' | 'inactive';
      created_at: Date;
    }>(
      `SELECT m.id, m.user_id, u.mobile, u.full_name, m.role_code, m.status, m.created_at
         FROM company_memberships m
         JOIN users u ON u.id = m.user_id
        WHERE m.company_id = $1
        ORDER BY m.created_at ASC`,
      [companyId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      mobile: row.mobile,
      fullName: row.full_name,
      role: row.role_code,
      status: row.status,
      createdAt: row.created_at.toISOString(),
    }));
  }

  async add(input: AddMembershipInput): Promise<AddMembershipResult> {
    const { companyId, userId } = this.requireContext();
    const fullName = input.fullName.trim();
    if (fullName.length < 2) {
      throw new AppError('VALIDATION_ERROR', {
        details: [
          {
            field: 'fullName',
            code: 'INVALID_NAME',
            message: 'نام کاربر باید حداقل ۲ نویسه غیرفاصله باشد.',
          },
        ],
      });
    }
    const mobile = normalizeIranianMobile(input.mobile);
    if (!mobile) {
      throw new AppError('VALIDATION_ERROR', {
        details: [
          {
            field: 'mobile',
            code: 'INVALID_MOBILE',
            message: 'شماره موبایل معتبر نیست.',
          },
        ],
      });
    }

    let targetUser = await this.db.query<{
      id: string;
      password_hash: string | null;
      status: string;
    }>('SELECT id, password_hash, status FROM users WHERE mobile = $1', [mobile]);

    let createdUser = false;
    if (!targetUser.rows[0]) {
      targetUser = await this.db.query<{
        id: string;
        password_hash: string | null;
        status: string;
      }>(
        `INSERT INTO users (mobile, full_name)
         VALUES ($1, $2)
         RETURNING id, password_hash, status`,
        [mobile, fullName],
      );
      createdUser = true;
    }

    const target = targetUser.rows[0];

    const existing = await this.db.query<{ id: string }>(
      'SELECT id FROM company_memberships WHERE company_id = $1 AND user_id = $2',
      [companyId, target.id],
    );
    if (existing.rows[0]) {
      throw new AppError('MEMBERSHIP_EXISTS');
    }

    let membership;
    try {
      membership = await this.db.query<{
        id: string;
        created_at: Date;
      }>(
        `INSERT INTO company_memberships (user_id, company_id, role_code)
         VALUES ($1, $2, $3)
         RETURNING id, created_at`,
        [target.id, companyId, input.role],
      );
    } catch (error) {
      if (isUniqueViolation(error, 'memberships_user_company_unique')) {
        throw new AppError('MEMBERSHIP_EXISTS');
      }
      throw error;
    }

    let inviteToken: string | undefined;
    let inviteExpiresAt: string | undefined;
    if (!target.password_hash) {
      const reset = await this.passwordReset.issueToken(target.id, 'user', userId);
      inviteToken = reset.token;
      inviteExpiresAt = reset.expiresAt.toISOString();
    }

    const view: MembershipView = {
      id: membership.rows[0].id,
      userId: target.id,
      mobile,
      fullName,
      role: input.role,
      status: 'active',
      createdAt: membership.rows[0].created_at.toISOString(),
    };

    await this.audit.record({
      companyId,
      action: 'membership.created',
      entityType: 'company_membership',
      entityId: view.id,
      details: {
        targetUserId: target.id,
        role: input.role,
        createdUser,
        inviteIssued: Boolean(inviteToken),
      },
    });

    return { membership: view, inviteToken, inviteExpiresAt };
  }

  async update(membershipId: string, input: UpdateMembershipInput): Promise<MembershipView> {
    const { companyId, userId } = this.requireContext();
    assertUuid(membershipId);

    const found = await this.db.query<{
      id: string;
      user_id: string;
      role_code: RoleCode;
      status: 'active' | 'inactive';
    }>(
      `SELECT id, user_id, role_code, status
         FROM company_memberships
        WHERE id = $1 AND company_id = $2`,
      [membershipId, companyId],
    );
    const target = found.rows[0];
    if (!target) throw new AppError('RESOURCE_NOT_FOUND');

    if (target.user_id === userId) {
      throw new AppError('SELF_MANAGEMENT_FORBIDDEN');
    }

    const nextRole = input.role ?? target.role_code;
    const nextStatus = input.status ?? target.status;

    const losesManager =
      target.role_code === 'manager' &&
      target.status === 'active' &&
      (nextRole !== 'manager' || nextStatus !== 'active');

    if (losesManager) {
      const others = await this.db.query<{ count: string }>(
        `SELECT count(*) AS count
           FROM company_memberships
          WHERE company_id = $1
            AND role_code = 'manager'
            AND status = 'active'
            AND id <> $2`,
        [companyId, target.id],
      );
      if (Number(others.rows[0]?.count ?? 0) === 0) {
        throw new AppError('LAST_MANAGER_REQUIRED');
      }
    }

    await this.db.query(
      `UPDATE company_memberships
          SET role_code = $1, status = $2
        WHERE id = $3 AND company_id = $4`,
      [nextRole, nextStatus, target.id, companyId],
    );

    const updated = await this.db.query<{
      id: string;
      user_id: string;
      mobile: string;
      full_name: string;
      role_code: RoleCode;
      status: 'active' | 'inactive';
      created_at: Date;
    }>(
      `SELECT m.id, m.user_id, u.mobile, u.full_name, m.role_code, m.status, m.created_at
         FROM company_memberships m
         JOIN users u ON u.id = m.user_id
        WHERE m.id = $1 AND m.company_id = $2`,
      [target.id, companyId],
    );
    const row = updated.rows[0];

    await this.audit.record({
      companyId,
      action: 'membership.updated',
      entityType: 'company_membership',
      entityId: target.id,
      details: {
        targetUserId: target.user_id,
        before: { role: target.role_code, status: target.status },
        after: { role: nextRole, status: nextStatus },
      },
    });

    return {
      id: row.id,
      userId: row.user_id,
      mobile: row.mobile,
      fullName: row.full_name,
      role: row.role_code,
      status: row.status,
      createdAt: row.created_at.toISOString(),
    };
  }

  async issuePasswordReset(
    membershipId: string,
  ): Promise<{ token: string; expiresAt: string }> {
    const { companyId, userId } = this.requireContext();
    assertUuid(membershipId);

    const found = await this.db.query<{ user_id: string }>(
      `SELECT user_id FROM company_memberships
        WHERE id = $1 AND company_id = $2`,
      [membershipId, companyId],
    );
    const target = found.rows[0];
    if (!target) throw new AppError('RESOURCE_NOT_FOUND');

    const reset = await this.passwordReset.issueToken(target.user_id, 'user', userId);

    await this.audit.record({
      companyId,
      action: 'membership.password_reset_issued',
      entityType: 'company_membership',
      entityId: membershipId,
      details: { targetUserId: target.user_id },
    });

    return { token: reset.token, expiresAt: reset.expiresAt.toISOString() };
  }
}
