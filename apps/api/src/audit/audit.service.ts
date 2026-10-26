import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../db/database.service';
import { currentRequestId, currentStore } from '../common/request-context';

export interface AuditInput {
  companyId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
}

/**
 * Audit trail for sensitive operations. Events are inserted inside the caller's
 * transaction, so a committed business change always has its audit record.
 * `details` must never contain passwords, tokens or cookies.
 */
@Injectable()
export class AuditService {
  constructor(private readonly db: DatabaseService) {}

  async record(input: AuditInput): Promise<void> {
    const store = currentStore();
    const actor = store.platformAdmin
      ? { type: 'platform_admin', id: store.platformAdmin.id }
      : store.user
        ? { type: 'user', id: store.user.id }
        : { type: 'system', id: null };

    await this.db.query(
      `INSERT INTO audit_events
         (company_id, actor_type, actor_id, action, entity_type, entity_id,
          details, request_id, ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)`,
      [
        input.companyId,
        actor.type,
        actor.id,
        input.action,
        input.entityType,
        input.entityId ?? null,
        JSON.stringify(input.details ?? {}),
        currentRequestId(),
        store.ip ?? null,
      ],
    );
  }
}
