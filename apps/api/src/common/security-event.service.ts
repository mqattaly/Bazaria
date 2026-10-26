import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../db/database.service';
import { currentRequestId, currentStore } from './request-context';

/**
 * Security events that must survive a failed request. These inserts use a
 * dedicated pool query (outside the request transaction) so a rollback caused
 * by an authorization failure does not erase the evidence.
 */
@Injectable()
export class SecurityEventService {
  constructor(private readonly db: DatabaseService) {}

  async recordStandalone(
    eventType: string,
    details: Record<string, unknown>,
    options: {
      userId?: string | null;
      platformAdminId?: string | null;
      identifier?: string | null;
    } = {},
  ): Promise<void> {
    const store = currentStore();
    await this.db.pool.query(
      `INSERT INTO security_events
         (event_type, user_id, platform_admin_id, identifier, ip, user_agent, request_id, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
      [
        eventType,
        options.userId ?? null,
        options.platformAdminId ?? null,
        options.identifier ?? null,
        store?.ip ?? null,
        store?.userAgent ?? null,
        currentRequestId(),
        JSON.stringify(details),
      ],
    );
  }
}
