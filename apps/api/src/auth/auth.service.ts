import { randomBytes } from 'node:crypto';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../db/database.service';
import { PasswordHasher } from './password-hasher.service';
import { SessionService } from './session.service';
import { LoginThrottleService } from './login-throttle.service';
import { normalizeIranianMobile } from './phone';
import { assertPasswordPolicy } from './password-policy';
import { AppError } from '../common/errors';
import { currentRequestId, currentStore } from '../common/request-context';
import {
  ROLE_PERMISSIONS,
  type MeResponse,
  type MyCompany,
  type RoleCode,
} from '@bazaria/shared';

export interface LoginResult {
  token: string;
  expiresAt: Date;
  user: MeResponse;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyHash = '';

  constructor(
    private readonly db: DatabaseService,
    private readonly hasher: PasswordHasher,
    private readonly sessions: SessionService,
    private readonly throttle: LoginThrottleService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Spends the same hashing time when the supplied mobile is unknown, so
    // response timing does not reveal whether an account exists.
    this.dummyHash = await this.hasher.hash(randomBytes(16).toString('hex'));
  }

  async login(
    mobileInput: string,
    password: string,
    ip?: string,
    userAgent?: string,
  ): Promise<LoginResult> {
    const mobile = normalizeIranianMobile(mobileInput);

    if (!mobile) {
      await this.throttle.assertNotLocked('user', null, ip ?? null);
      await this.throttle.recordFailure(
        'user',
        null,
        ip ?? null,
        userAgent ?? null,
        'invalid_mobile',
      );
      throw new AppError('AUTH_INVALID_CREDENTIALS');
    }

    await this.throttle.assertNotLocked('user', mobile, ip ?? null);

    const found = await this.db.query<{
      id: string;
      mobile: string;
      full_name: string;
      password_hash: string | null;
      status: string;
    }>(
      'SELECT id, mobile, full_name, password_hash, status FROM users WHERE mobile = $1',
      [mobile],
    );
    const user = found.rows[0];

    const hashToCheck = user?.password_hash ?? this.dummyHash;
    const passwordOk = await this.hasher.verify(hashToCheck, password);

    if (!user || !passwordOk) {
      await this.throttle.recordFailure(
        'user',
        mobile,
        ip ?? null,
        userAgent ?? null,
        user ? 'wrong_password' : 'unknown_mobile',
        user?.id ?? null,
      );
      throw new AppError('AUTH_INVALID_CREDENTIALS');
    }

    if (user.status !== 'active') {
      await this.throttle.recordFailure(
        'user',
        mobile,
        ip ?? null,
        userAgent ?? null,
        'inactive_user',
        user.id,
      );
      throw new AppError('AUTH_INVALID_CREDENTIALS');
    }

    const session = await this.sessions.createUserSession(user.id, ip, userAgent);
    await this.throttle.recordSuccess('user', mobile, ip ?? null, userAgent ?? null, user.id);

    return {
      token: session.token,
      expiresAt: session.expiresAt,
      user: {
        id: user.id,
        mobile: user.mobile,
        fullName: user.full_name,
        status: 'active',
      },
    };
  }

  async me(): Promise<MeResponse> {
    const store = currentStore();
    if (!store.user) throw new AppError('AUTH_REQUIRED');
    const result = await this.db.query<{
      id: string;
      mobile: string;
      full_name: string;
      status: string;
    }>('SELECT id, mobile, full_name, status FROM users WHERE id = $1', [store.user.id]);
    const row = result.rows[0];
    if (!row || row.status !== 'active') throw new AppError('AUTH_REQUIRED');
    return {
      id: row.id,
      mobile: row.mobile,
      fullName: row.full_name,
      status: 'active',
    };
  }

  async myCompanies(): Promise<MyCompany[]> {
    const store = currentStore();
    if (!store.user) throw new AppError('AUTH_REQUIRED');
    const result = await this.db.query<{
      id: string;
      name: string;
      code: string;
      status: string;
      currency: string;
      role_code: RoleCode;
      membership_id: string;
    }>(
      `SELECT c.id, c.name, c.code, c.status, c.currency,
              m.role_code, m.id AS membership_id
         FROM company_memberships m
         JOIN companies c ON c.id = m.company_id
        WHERE m.user_id = $1 AND m.status = 'active'
        ORDER BY c.name`,
      [store.user.id],
    );
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      code: row.code,
      status: row.status as MyCompany['status'],
      currency: row.currency,
      role: row.role_code,
      membershipId: row.membership_id,
      permissions: ROLE_PERMISSIONS[row.role_code],
    }));
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const store = currentStore();
    if (!store.user) throw new AppError('AUTH_REQUIRED');

    const result = await this.db.query<{ password_hash: string | null }>(
      'SELECT password_hash FROM users WHERE id = $1',
      [store.user.id],
    );
    const currentHash = result.rows[0]?.password_hash;
    if (!currentHash || !(await this.hasher.verify(currentHash, currentPassword))) {
      throw new AppError('AUTH_INVALID_CREDENTIALS');
    }
    if (await this.hasher.verify(currentHash, newPassword)) {
      throw new AppError('PASSWORD_POLICY_VIOLATION', {
        details: [
          {
            code: 'PASSWORD_UNCHANGED',
            message: 'رمز عبور جدید باید با رمز فعلی متفاوت باشد.',
          },
        ],
      });
    }
    assertPasswordPolicy(newPassword, store.user.mobile);

    const newHash = await this.hasher.hash(newPassword);
    await this.db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
      newHash,
      store.user.id,
    ]);
    await this.sessions.revokeOtherUserSessions(store.user.id, store.sessionId ?? '');
    await this.recordSecurityEvent('auth.password.changed');
  }

  async revokeCurrentSession(): Promise<void> {
    const store = currentStore();
    if (store.sessionId) {
      await this.sessions.revokeUserSession(store.sessionId);
    }
  }

  private async recordSecurityEvent(eventType: string): Promise<void> {
    const store = currentStore();
    const subjectColumn = store.platformAdmin ? 'platform_admin_id' : 'user_id';
    const subjectId = store.platformAdmin?.id ?? store.user?.id ?? null;
    await this.db.query(
      `INSERT INTO security_events
         (event_type, ${subjectColumn}, request_id, ip)
       VALUES ($1, $2, $3, $4)`,
      [eventType, subjectId, currentRequestId(), store.ip ?? null],
    );
  }
}
