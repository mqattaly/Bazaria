import { requireDatabaseUrl } from '../src/config/env';
import { normalizeIranianMobile } from '../src/auth/phone';
import { isRoleCode } from '@bazaria/shared';
import { withClient } from './db-utils';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

/**
 * Grants (or updates) a membership for an existing user. Used to bootstrap a
 * first manager after a company is created outside the API, and for support
 * recovery. Every change is recorded in security_events.
 */
async function main(): Promise<void> {
  const mobileInput = argument('mobile');
  const companyCode = argument('company')?.toUpperCase();
  const role = argument('role');

  if (!mobileInput || !companyCode || !role) {
    throw new Error(
      'Usage: membership:grant --mobile <mobile> --company <CODE> --role <manager|sales_representative|warehouse_user>',
    );
  }
  const mobile = normalizeIranianMobile(mobileInput);
  if (!mobile) throw new Error('Invalid Iranian mobile number');
  if (!isRoleCode(role)) throw new Error('Invalid role code');

  await withClient(requireDatabaseUrl(), async (client) => {
    await client.query('BEGIN');
    try {
      await client.query(`SELECT set_config('app.platform_admin', 'on', true)`);

      const user = await client.query<{ id: string }>(
        'SELECT id FROM users WHERE mobile = $1',
        [mobile],
      );
      if (!user.rows[0]) throw new Error('User not found; create the user first');

      const company = await client.query<{ id: string }>(
        'SELECT id FROM companies WHERE code = $1',
        [companyCode],
      );
      if (!company.rows[0]) throw new Error('Company not found');

      const membership = await client.query<{ id: string }>(
        `INSERT INTO company_memberships (user_id, company_id, role_code, status)
         VALUES ($1, $2, $3, 'active')
         ON CONFLICT (user_id, company_id)
         DO UPDATE SET role_code = EXCLUDED.role_code, status = 'active'
         RETURNING id`,
        [user.rows[0].id, company.rows[0].id, role],
      );

      await client.query(
        `INSERT INTO security_events (event_type, user_id, details)
         VALUES ('membership.cli_granted', $1, $2::jsonb)`,
        [
          user.rows[0].id,
          JSON.stringify({
            companyId: company.rows[0].id,
            role,
            membershipId: membership.rows[0].id,
          }),
        ],
      );

      await client.query('COMMIT');
      console.log(`Membership active: user ${user.rows[0].id} role ${role} in ${companyCode}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

main().catch((error: unknown) => {
  console.error(`Grant membership failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
