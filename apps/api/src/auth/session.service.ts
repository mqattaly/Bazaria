import { randomBytes, createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../db/database.service';
import { env } from '../config/env';
import type { AuthUser, PlatformAdminIdentity } from '../common/request-context';

export interface CreatedSession {
  token: string;
  sessionId: string;
  expiresAt: Date;
}

export interface ResolvedUserSession {
  sessionId: string;
  user: AuthUser;
  expiresAt: Date;
}

export interface ResolvedPlatformSession {
  sessionId: string;
  admin: PlatformAdminIdentity;
  expiresAt: Date;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Opaque server-side sessions. The cookie carries a random token; the database
 * stores only its SHA-256 hash, so a database read cannot be replayed as a
 * session. Revocation is a single UPDATE and takes effect on the next request.
 */
@Injectable()
export class SessionService {
  constructor(private readonly db: DatabaseService) {}

  private async insertSession(
    client: PoolClient | undefined,
    table: 'sessions' | 'platform_sessions',
    subjectColumn: 'user_id' | 'admin_id',
    subjectId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<CreatedSession> {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + env.sessionTtlHours * 60 * 60 * 1000);
    const sql = `
      INSERT INTO ${table} (${subjectColumn}, token_hash, expires_at, ip, user_agent)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;
    const params = [subjectId, tokenHash, expiresAt, ip ?? null, userAgent ?? null];
    const result = client
      ? await client.query<{ id: string }>(sql, params)
      : await this.db.query<{ id: string }>(sql, params);

    return { token, sessionId: result.rows[0].id, expiresAt };
  }

  createUserSession(
    userId: string,
    ip?: string,
    userAgent?: string,
    client?: PoolClient,
  ): Promise<CreatedSession> {
    return this.insertSession(client, 'sessions', 'user_id', userId, ip, userAgent);
  }

  createPlatformSession(
    adminId: string,
    ip?: string,
    userAgent?: string,
    client?: PoolClient,
  ): Promise<CreatedSession> {
    return this.insertSession(
      client,
      'platform_sessions',
      'admin_id',
      adminId,
      ip,
      userAgent,
    );
  }

  async resolveUserSession(token: string): Promise<ResolvedUserSession | null> {
    if (!token) return null;
    const result = await this.db.query<{
      session_id: string;
      user_id: string;
      expires_at: Date;
      revoked_at: Date | null;
      status: string;
      mobile: string;
      full_name: string;
    }>(
      `SELECT s.id AS session_id, s.user_id, s.expires_at, s.revoked_at,
              u.status, u.mobile, u.full_name
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = $1`,
      [hashToken(token)],
    );

    const row = result.rows[0];
    if (!row) return null;
    if (row.revoked_at) return null;
    if (row.status !== 'active') return null;
    if (new Date(row.expires_at).getTime() <= Date.now()) return null;

    await this.db.query(
      `UPDATE sessions
          SET last_used_at = now()
        WHERE id = $1
          AND (last_used_at IS NULL OR last_used_at < now() - interval '60 seconds')`,
      [row.session_id],
    );

    return {
      sessionId: row.session_id,
      user: { id: row.user_id, mobile: row.mobile, fullName: row.full_name },
      expiresAt: row.expires_at,
    };
  }

  async resolvePlatformSession(token: string): Promise<ResolvedPlatformSession | null> {
    if (!token) return null;
    const result = await this.db.query<{
      session_id: string;
      admin_id: string;
      expires_at: Date;
      revoked_at: Date | null;
      status: string;
      username: string;
      full_name: string;
    }>(
      `SELECT s.id AS session_id, s.admin_id, s.expires_at, s.revoked_at,
              a.status, a.username, a.full_name
         FROM platform_sessions s
         JOIN platform_admins a ON a.id = s.admin_id
        WHERE s.token_hash = $1`,
      [hashToken(token)],
    );

    const row = result.rows[0];
    if (!row) return null;
    if (row.revoked_at) return null;
    if (row.status !== 'active') return null;
    if (new Date(row.expires_at).getTime() <= Date.now()) return null;

    await this.db.query(
      `UPDATE platform_sessions
          SET last_used_at = now()
        WHERE id = $1
          AND (last_used_at IS NULL OR last_used_at < now() - interval '60 seconds')`,
      [row.session_id],
    );

    return {
      sessionId: row.session_id,
      admin: { id: row.admin_id, username: row.username, fullName: row.full_name },
      expiresAt: row.expires_at,
    };
  }

  async revokeUserSession(sessionId: string): Promise<void> {
    await this.db.query(
      'UPDATE sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL',
      [sessionId],
    );
  }

  async revokePlatformSession(sessionId: string): Promise<void> {
    await this.db.query(
      'UPDATE platform_sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL',
      [sessionId],
    );
  }

  async revokeOtherUserSessions(userId: string, keepSessionId: string): Promise<void> {
    await this.db.query(
      `UPDATE sessions SET revoked_at = now()
        WHERE user_id = $1 AND id <> $2 AND revoked_at IS NULL`,
      [userId, keepSessionId],
    );
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    await this.db.query(
      'UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
      [userId],
    );
  }
}
