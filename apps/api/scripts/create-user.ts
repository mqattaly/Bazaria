import { createHash, randomBytes } from 'node:crypto';
import { requireDatabaseUrl } from '../src/config/env';
import { normalizeIranianMobile } from '../src/auth/phone';
import { withClient } from './db-utils';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

/**
 * Provisions a company user without a password and prints a one-time
 * activation token. No password is ever passed on the command line.
 */
async function main(): Promise<void> {
  const mobileInput = argument('mobile');
  const fullName = argument('name');
  if (!mobileInput || !fullName) {
    throw new Error('Usage: user:create --mobile <mobile> --name "<full name>"');
  }
  const mobile = normalizeIranianMobile(mobileInput);
  if (!mobile) throw new Error('Invalid Iranian mobile number');

  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');

  await withClient(requireDatabaseUrl(), async (client) => {
    await client.query('BEGIN');
    try {
      await client.query(`SELECT set_config('app.platform_admin', 'on', true)`);
      const existing = await client.query<{ id: string }>(
        'SELECT id FROM users WHERE mobile = $1',
        [mobile],
      );

      let userId: string;
      if (existing.rows[0]) {
        userId = existing.rows[0].id;
        console.log(`User already exists: ${userId} (no new account created)`);
      } else {
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO users (mobile, full_name) VALUES ($1, $2) RETURNING id`,
          [mobile, fullName.trim()],
        );
        userId = inserted.rows[0].id;
        console.log(`User created: ${userId}`);

        await client.query(
          `INSERT INTO password_reset_tokens
             (user_id, token_hash, expires_at, created_by_type)
           VALUES ($1, $2, now() + interval '60 minutes', 'system')`,
          [userId, tokenHash],
        );
        console.log('One-time activation token (valid 60 minutes, shown once):');
        console.log(token);
      }

      await client.query(
        `INSERT INTO security_events (event_type, user_id, details)
         VALUES ('account.provisioned', $1, $2::jsonb)`,
        [userId, JSON.stringify({ source: 'cli' })],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

main().catch((error: unknown) => {
  console.error(`Create user failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
