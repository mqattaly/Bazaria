import type { PoolClient } from 'pg';

/**
 * RLS context is transaction-local (`set_config(..., true)`). A pooled
 * connection can never leak one company's context into the next request:
 * settings disappear on COMMIT/ROLLBACK.
 */
export async function setUserContext(
  client: PoolClient,
  userId: string,
): Promise<void> {
  await client.query(`SELECT set_config('app.user_id', $1, true)`, [userId]);
}

export async function setCompanyContext(
  client: PoolClient,
  companyId: string,
): Promise<void> {
  await client.query(`SELECT set_config('app.company_id', $1, true)`, [companyId]);
}

export async function setPlatformContext(client: PoolClient): Promise<void> {
  await client.query(`SELECT set_config('app.platform_admin', 'on', true)`);
}
