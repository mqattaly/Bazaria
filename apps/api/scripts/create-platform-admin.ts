import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import { requireDatabaseUrl } from '../src/config/env';
import { assertPasswordPolicy } from '../src/auth/password-policy';
import { withClient } from './db-utils';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

/**
 * Creates a platform administrator. The password comes from
 * PLATFORM_ADMIN_PASSWORD or is generated and printed once. There is no
 * default account and no public elevation endpoint.
 */
async function main(): Promise<void> {
  const username = argument('username')?.trim().toLowerCase();
  const fullName = argument('name')?.trim();
  if (!username || !fullName) {
    throw new Error(
      'Usage: platform-admin:create --username <username> --name "<full name>" [PLATFORM_ADMIN_PASSWORD=...]',
    );
  }
  if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(username)) {
    throw new Error('Username must be 3-64 lowercase letters, digits, dot, underscore or dash');
  }

  const password = process.env.PLATFORM_ADMIN_PASSWORD ?? `Aa1${randomBytes(12).toString('hex')}`;
  assertPasswordPolicy(password);
  const hash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  await withClient(requireDatabaseUrl(), async (client) => {
    await client.query('BEGIN');
    try {
      await client.query(`SELECT set_config('app.platform_admin', 'on', true)`);
      const existing = await client.query('SELECT 1 FROM platform_admins WHERE username = $1', [
        username,
      ]);
      if (existing.rowCount && existing.rowCount > 0) {
        throw new Error('Platform admin with this username already exists');
      }

      const inserted = await client.query<{ id: string }>(
        `INSERT INTO platform_admins (username, full_name, password_hash)
         VALUES ($1, $2, $3) RETURNING id`,
        [username, fullName, hash],
      );

      await client.query(
        `INSERT INTO security_events (event_type, platform_admin_id, details)
         VALUES ('platform.admin.created', $1, $2::jsonb)`,
        [inserted.rows[0].id, JSON.stringify({ source: 'cli', username })],
      );

      await client.query('COMMIT');
      console.log(`Platform admin created: ${username} (${inserted.rows[0].id})`);
      if (!process.env.PLATFORM_ADMIN_PASSWORD) {
        console.log('Generated password (shown once):');
        console.log(password);
      }
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

main().catch((error: unknown) => {
  console.error(`Create platform admin failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
