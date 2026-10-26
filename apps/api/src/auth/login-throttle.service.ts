import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../db/database.service';
import { env } from '../config/env';
import { AppError } from '../common/errors';
import { currentRequestId } from '../common/request-context';

type LoginKind = 'user' | 'platform';

const FAILURE_EVENT: Record<LoginKind, string> = {
  user: 'auth.login.failed',
  platform: 'platform.login.failed',
};

/**
 * Failed-login accounting. Failures are counted per identifier and per IP in a
 * rolling window; once either threshold is reached the account is locked for
 * the remainder of the window. Events are stored in security_events and never
 * contain credentials.
 */
@Injectable()
export class LoginThrottleService {
  constructor(private readonly db: DatabaseService) {}

  private async countFailures(
    kind: LoginKind,
    identifier: string | null,
    ip: string | null,
  ): Promise<{ identifierFailures: number; ipFailures: number }> {
    const eventType = FAILURE_EVENT[kind];
    const result = await this.db.query<{ identifier_failures: string; ip_failures: string }>(
      `SELECT
         count(*) FILTER (WHERE identifier = $1) AS identifier_failures,
         count(*) FILTER (WHERE ip = $2) AS ip_failures
       FROM security_events
       WHERE event_type = $3
         AND created_at > now() - make_interval(mins => $4)
         AND (($1::text IS NOT NULL AND identifier = $1) OR ($2::text IS NOT NULL AND ip = $2))`,
      [identifier, ip, eventType, env.loginWindowMinutes],
    );
    return {
      identifierFailures: Number(result.rows[0]?.identifier_failures ?? 0),
      ipFailures: Number(result.rows[0]?.ip_failures ?? 0),
    };
  }

  async assertNotLocked(
    kind: LoginKind,
    identifier: string | null,
    ip: string | null,
  ): Promise<void> {
    const { identifierFailures, ipFailures } = await this.countFailures(
      kind,
      identifier,
      ip,
    );
    const identifierLimit =
      kind === 'user' ? env.loginMaxFailuresPhone : env.loginMaxFailuresPhone;
    if (identifierFailures >= identifierLimit || ipFailures >= env.loginMaxFailuresIp) {
      await this.recordEvent(kind, identifier, null, null, 'lockout_triggered');
      throw new AppError('AUTH_ACCOUNT_LOCKED');
    }
  }

  async recordFailure(
    kind: LoginKind,
    identifier: string | null,
    ip: string | null,
    userAgent: string | null,
    reason: string,
    subjectId?: string | null,
  ): Promise<void> {
    const eventType = FAILURE_EVENT[kind];
    const subjectColumn = kind === 'user' ? 'user_id' : 'platform_admin_id';
    // Standalone write: the request transaction is rolled back when login fails.
    await this.db.pool.query(
      `INSERT INTO security_events
         (event_type, ${subjectColumn}, identifier, ip, user_agent, request_id, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [
        eventType,
        subjectId ?? null,
        identifier,
        ip,
        userAgent,
        currentRequestId(),
        JSON.stringify({ reason }),
      ],
    );
  }

  async recordSuccess(
    kind: LoginKind,
    identifier: string | null,
    ip: string | null,
    userAgent: string | null,
    subjectId: string,
  ): Promise<void> {
    const subjectColumn = kind === 'user' ? 'user_id' : 'platform_admin_id';
    await this.db.query(
      `INSERT INTO security_events
         (event_type, ${subjectColumn}, identifier, ip, user_agent, request_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        kind === 'user' ? 'auth.login.succeeded' : 'platform.login.succeeded',
        subjectId,
        identifier,
        ip,
        userAgent,
        currentRequestId(),
      ],
    );
  }

  private async recordEvent(
    kind: LoginKind,
    identifier: string | null,
    ip: string | null,
    userAgent: string | null,
    reason: string,
  ): Promise<void> {
    await this.db.pool.query(
      `INSERT INTO security_events
         (event_type, identifier, ip, user_agent, request_id, details)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        kind === 'user' ? 'auth.login.failed' : 'platform.login.failed',
        identifier,
        ip,
        userAgent,
        currentRequestId(),
        JSON.stringify({ reason }),
      ],
    );
  }
}
