import { createHash, randomBytes } from 'node:crypto';
import { requireDatabaseUrl } from '../src/config/env';
import { withClient } from './db-utils';

function randomPassword(): string {
  return `Aa1${randomBytes(9).toString('hex')}`;
}

function resetTokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Development-only seed. Passwords are random and printed once; there is no
 * default credential in the repository.
 */
async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('seed-dev refuses to run in production');
  }

  const demoPassword = randomPassword();

  await withClient(requireDatabaseUrl(), async (client) => {
    await client.query('BEGIN');
    try {
      await client.query(`SELECT set_config('app.platform_admin', 'on', true)`);

      const existing = await client.query('SELECT 1 FROM companies WHERE code = $1', [
        'DEMO-MAIN',
      ]);
      if (existing.rowCount && existing.rowCount > 0) {
        await client.query('ROLLBACK');
        console.log('Seed data already present; nothing to do.');
        return;
      }

      const companies = [
        { name: 'شرکت نمونه بازار', code: 'DEMO-MAIN', maxStores: 5 },
        { name: 'شرکت دوم نمونه', code: 'DEMO-SECOND', maxStores: 2 },
      ];

      const companyIds: Record<string, string> = {};
      const entitlements: Record<string, string> = {};

      for (const company of companies) {
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO companies (name, code, currency) VALUES ($1, $2, 'IRR') RETURNING id`,
          [company.name, company.code],
        );
        companyIds[company.code] = inserted.rows[0].id;

        const entitlement = await client.query<{ company_id: string }>(
          `INSERT INTO company_entitlements (company_id, status, max_stores)
           VALUES ($1, 'active', $2) RETURNING company_id`,
          [inserted.rows[0].id, company.maxStores],
        );
        entitlements[company.code] = entitlement.rows[0].company_id;

        await client.query(
          `INSERT INTO audit_events
             (company_id, actor_type, action, entity_type, entity_id, details)
           VALUES ($1, 'system', 'dev.seed.company_created', 'company', $3::text, $2::jsonb)`,
          [
            inserted.rows[0].id,
            JSON.stringify({ code: company.code }),
            inserted.rows[0].id,
          ],
        );
      }

      const users = [
        {
          mobile: '+989120000001',
          fullName: 'مدیر نمونه',
          memberships: [
            { code: 'DEMO-MAIN', role: 'manager' },
            { code: 'DEMO-SECOND', role: 'sales_representative' },
          ],
        },
        {
          mobile: '+989120000002',
          fullName: 'کارشناس انبار نمونه',
          memberships: [{ code: 'DEMO-MAIN', role: 'warehouse_user' }],
        },
        {
          mobile: '+989120000003',
          fullName: 'مدیر شرکت دوم',
          memberships: [{ code: 'DEMO-SECOND', role: 'manager' }],
        },
      ];

      const passwordHash = await import('argon2').then((argon2) =>
        argon2.hash(demoPassword, {
          type: argon2.argon2id,
          memoryCost: 19456,
          timeCost: 2,
          parallelism: 1,
        }),
      );

      for (const user of users) {
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO users (mobile, full_name, password_hash)
           VALUES ($1, $2, $3) RETURNING id`,
          [user.mobile, user.fullName, passwordHash],
        );

        for (const membership of user.memberships) {
          await client.query(
            `INSERT INTO company_memberships (user_id, company_id, role_code)
             VALUES ($1, $2, $3)`,
            [inserted.rows[0].id, companyIds[membership.code], membership.role],
          );
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });

  console.log('Development seed created (companies: DEMO-MAIN, DEMO-SECOND).');
  console.log('Users (password is the same for all seeded users):');
  console.log('  +989120000001  مدیر نمونه          (manager in DEMO-MAIN, sales in DEMO-SECOND)');
  console.log('  +989120000002  کارشناس انبار نمونه   (warehouse_user in DEMO-MAIN)');
  console.log('  +989120000003  مدیر شرکت دوم       (manager in DEMO-SECOND)');
  console.log(`Password: ${demoPassword}`);
  console.log('This password is printed once and is not stored anywhere in plain text.');
}

main().catch((error: unknown) => {
  console.error(`Seed failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
