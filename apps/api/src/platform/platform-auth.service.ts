import { randomBytes } from 'node:crypto';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../db/database.service';
import { PasswordHasher } from '../auth/password-hasher.service';
import { SessionService } from '../auth/session.service';
import { LoginThrottleService } from '../auth/login-throttle.service';
import { AppError } from '../common/errors';
import type { PlatformAdminIdentity } from '../common/request-context';

export interface PlatformLoginResult {
  token: string;
  expiresAt: Date;
  admin: PlatformAdminIdentity;
}

/**
 * Platform administrator authentication. This path shares no table, cookie or
 * route with company-user authentication: a token from one cannot be used on
 * the other (DEC-009).
 */
@Injectable()
export class PlatformAuthService implements OnModuleInit {
  private dummyHash = '';

  constructor(
    private readonly db: DatabaseService,
    private readonly hasher: PasswordHasher,
    private readonly sessions: SessionService,
    private readonly throttle: LoginThrottleService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.dummyHash = await this.hasher.hash(randomBytes(16).toString('hex'));
  }

  async login(
    usernameInput: string,
    password: string,
    ip?: string,
    userAgent?: string,
  ): Promise<PlatformLoginResult> {
    const username = usernameInput.trim().toLowerCase();
    const identifier = `platform:${username}`;

    await this.throttle.assertNotLocked('platform', identifier, ip ?? null);

    const found = await this.db.query<{
      id: string;
      username: string;
      full_name: string;
      password_hash: string;
      status: string;
    }>(
      `SELECT id, username, full_name, password_hash, status
         FROM platform_admins WHERE username = $1`,
      [username],
    );
    const admin = found.rows[0];

    const passwordOk = await this.hasher.verify(
      admin?.password_hash ?? this.dummyHash,
      password,
    );

    if (!admin || !passwordOk || admin.status !== 'active') {
      await this.throttle.recordFailure(
        'platform',
        identifier,
        ip ?? null,
        userAgent ?? null,
        admin ? (passwordOk ? 'inactive_admin' : 'wrong_password') : 'unknown_username',
        admin?.id ?? null,
      );
      throw new AppError('AUTH_INVALID_CREDENTIALS');
    }

    const session = await this.sessions.createPlatformSession(admin.id, ip, userAgent);
    await this.throttle.recordSuccess(
      'platform',
      identifier,
      ip ?? null,
      userAgent ?? null,
      admin.id,
    );

    return {
      token: session.token,
      expiresAt: session.expiresAt,
      admin: { id: admin.id, username: admin.username, fullName: admin.full_name },
    };
  }

  async revokeCurrentSession(sessionId: string): Promise<void> {
    await this.sessions.revokePlatformSession(sessionId);
  }
}
