import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../db/database.service';
import { PasswordHasher } from './password-hasher.service';
import { SessionService } from './session.service';
import { assertPasswordPolicy } from './password-policy';
import { AppError } from '../common/errors';
import { currentRequestId } from '../common/request-context';

export interface ResetTokenResult {
  token: string;
  expiresAt: Date;
}

/**
 * Single-use account activation / password reset tokens. Plain tokens are
 * returned exactly once to the issuer; only SHA-256 hashes are persisted.
 */
@Injectable()
export class PasswordResetService {
  constructor(
    private readonly db: DatabaseService,
    private readonly hasher: PasswordHasher,
    private readonly sessions: SessionService,
  ) {}

  async issueToken(
    userId: string,
    createdByType: 'user' | 'platform_admin' | 'system',
    createdById: string | null,
    ttlMinutes = 60,
  ): Promise<ResetTokenResult> {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    await this.db.query(
      `INSERT INTO password_reset_tokens
         (user_id, token_hash, expires_at, created_by_type, created_by_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, tokenHash, expiresAt, createdByType, createdById],
    );
    return { token, expiresAt };
  }

  async setPasswordWithToken(token: string, newPassword: string): Promise<void> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const result = await this.db.query<{
      id: string;
      user_id: string;
      expires_at: Date;
      used_at: Date | null;
      status: string;
    }>(
      `SELECT t.id, t.user_id, t.expires_at, t.used_at, u.status
         FROM password_reset_tokens t
         JOIN users u ON u.id = t.user_id
        WHERE t.token_hash = $1`,
      [tokenHash],
    );
    const row = result.rows[0];
    if (
      !row ||
      row.used_at ||
      row.status !== 'active' ||
      new Date(row.expires_at).getTime() <= Date.now()
    ) {
      throw new AppError('INVALID_RESET_TOKEN');
    }

    assertPasswordPolicy(newPassword);
    const hash = await this.hasher.hash(newPassword);

    await this.db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
      hash,
      row.user_id,
    ]);
    await this.db.query(
      'UPDATE password_reset_tokens SET used_at = now() WHERE id = $1',
      [row.id],
    );
    await this.sessions.revokeAllUserSessions(row.user_id);
    await this.db.query(
      `INSERT INTO security_events
         (event_type, user_id, request_id)
       VALUES ('auth.password.set', $1, $2)`,
      [row.user_id, currentRequestId()],
    );
  }
}
