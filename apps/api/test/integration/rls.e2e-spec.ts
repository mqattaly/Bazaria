import { Pool } from 'pg';
import {
  admin,
  closeAdminPool,
  resetDatabase,
  seedCompany,
  seedMembership,
  seedStore,
  seedUser,
  uniqueCode,
} from '../helpers/harness';

/**
 * These tests bypass the API on purpose: they use the real runtime role and
 * verify that PostgreSQL refuses cross-tenant access even if application code
 * were wrong. They also prove role separation (owner vs runtime).
 */
describe('PostgreSQL row level security with the runtime role (PH-1, PH-2)', () => {
  let appPool: Pool;
  let ownerPool: Pool;
  let companyA: string;
  let companyB: string;
  let userA: string;
  let userB: string;

  beforeAll(() => {
    appPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
    ownerPool = new Pool({ connectionString: process.env.DATABASE_OWNER_URL, max: 2 });
  });

  afterAll(async () => {
    await appPool.end();
    await ownerPool.end();
    await closeAdminPool();
  });

  beforeEach(async () => {
    await resetDatabase();
    const a = await seedCompany({ code: uniqueCode('RLSA'), name: 'شرکت آر ال اس' });
    const b = await seedCompany({ code: uniqueCode('RLSB'), name: 'شرکت بی آر ال اس' });
    companyA = a.companyId;
    companyB = b.companyId;

    userA = await seedUser({ mobile: '+989120000101', password: 'RlsPass12345' });
    userB = await seedUser({ mobile: '+989120000102', password: 'RlsPass12345' });
    await seedMembership({ userId: userA, companyId: companyA, role: 'manager' });
    await seedMembership({ userId: userA, companyId: companyB, role: 'warehouse_user' });
    await seedMembership({ userId: userB, companyId: companyA, role: 'sales_representative' });
  });

  async function withTransaction<T>(
    fn: (client: import('pg').PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await appPool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  it('uses a non-owner, non-superuser, non-BYPASSRLS runtime role', async () => {
    const role = await admin().query<{
      rolsuper: boolean;
      rolbypassrls: boolean;
      rolcreatedb: boolean;
      rolcreaterole: boolean;
    }>(
      `SELECT rolsuper, rolbypassrls, rolcreatedb, rolcreaterole
         FROM pg_roles WHERE rolname = 'bazaria_app'`,
    );
    expect(role.rows[0]).toEqual({
      rolsuper: false,
      rolbypassrls: false,
      rolcreatedb: false,
      rolcreaterole: false,
    });

    const ownership = await admin().query<{ owned: number }>(
      `SELECT count(*)::int AS owned
         FROM pg_class c
         JOIN pg_roles r ON r.oid = c.relowner
        WHERE r.rolname = 'bazaria_app'`,
    );
    expect(ownership.rows[0].owned).toBe(0);

    await expect(appPool.query('CREATE TABLE forbidden_table (id int)')).rejects.toThrow();
  });

  it('enables and forces RLS on every tenant table', async () => {
    const result = await admin().query<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
      policies: string;
    }>(
      `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
              count(p.polname)::text AS policies
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         LEFT JOIN pg_policy p ON p.polrelid = c.oid
        WHERE n.nspname = 'public'
          AND c.relname IN ('companies', 'company_entitlements', 'company_memberships',
                            'audit_events', 'stores')
        GROUP BY c.relname, c.relrowsecurity, c.relforcerowsecurity
        ORDER BY c.relname`,
    );
    expect(result.rowCount).toBe(5);
    for (const row of result.rows) {
      expect(row.relrowsecurity).toBe(true);
      expect(row.relforcerowsecurity).toBe(true);
      expect(Number(row.policies)).toBeGreaterThan(0);
    }
  });

  it('returns no tenant rows without a transaction-local context', async () => {
    const companies = await appPool.query('SELECT count(*)::int AS n FROM companies');
    expect(companies.rows[0].n).toBe(0);

    const memberships = await appPool.query('SELECT count(*)::int AS n FROM company_memberships');
    expect(memberships.rows[0].n).toBe(0);

    const audit = await appPool.query('SELECT count(*)::int AS n FROM audit_events');
    expect(audit.rows[0].n).toBe(0);

    const stores = await appPool.query('SELECT count(*)::int AS n FROM stores');
    expect(stores.rows[0].n).toBe(0);
  });

  it('filters to the company set in the current transaction', async () => {
    const ids = await withTransaction(async (client) => {
      await client.query(`SELECT set_config('app.company_id', $1, true)`, [companyA]);
      const result = await client.query<{ id: string }>('SELECT id FROM companies');
      return result.rows.map((row) => row.id);
    });
    expect(ids).toEqual([companyA]);

    const other = await withTransaction(async (client) => {
      await client.query(`SELECT set_config('app.company_id', $1, true)`, [companyB]);
      const result = await client.query<{ id: string }>('SELECT id FROM companies');
      return result.rows.map((row) => row.id);
    });
    expect(other).toEqual([companyB]);
  });

  it('does not leak context across commit, rollback or pooled connections', async () => {
    const client = await appPool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.company_id', $1, true)`, [companyA]);
      expect((await client.query('SELECT count(*)::int AS n FROM companies')).rows[0].n).toBe(1);
      await client.query('COMMIT');

      // Same pooled connection, new implicit transaction: context is gone.
      expect((await client.query('SELECT count(*)::int AS n FROM companies')).rows[0].n).toBe(0);

      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.company_id', $1, true)`, [companyA]);
      await client.query('ROLLBACK');
      expect((await client.query('SELECT count(*)::int AS n FROM companies')).rows[0].n).toBe(0);
    } finally {
      client.release();
    }
  });

  it('hides memberships of other users in the same company', async () => {
    const rows = await withTransaction(async (client) => {
      await client.query(`SELECT set_config('app.user_id', $1, true)`, [userA]);
      const result = await client.query<{ user_id: string }>(
        'SELECT user_id FROM company_memberships',
      );
      return result.rows.map((row) => row.user_id);
    });
    expect(rows).toEqual([userA, userA]);
  });

  it('blocks updates and audit writes aimed at another company', async () => {
    const updated = await withTransaction(async (client) => {
      await client.query(`SELECT set_config('app.company_id', $1, true)`, [companyA]);
      await client.query(`SELECT set_config('app.user_id', $1, true)`, [userA]);
      const result = await client.query(
        `UPDATE companies SET name = 'hacked' WHERE id = $1`,
        [companyB],
      );
      return result.rowCount;
    });
    expect(updated).toBe(0);

    await expect(
      withTransaction(async (client) => {
        await client.query(`SELECT set_config('app.company_id', $1, true)`, [companyA]);
        await client.query(`SELECT set_config('app.user_id', $1, true)`, [userA]);
        await client.query(
          `INSERT INTO audit_events (company_id, actor_type, action, entity_type)
           VALUES ($1, 'system', 'forged', 'company')`,
          [companyB],
        );
      }),
    ).rejects.toThrow(/row-level security|policy/i);
  });

  it('allows platform-only access when the platform flag is set', async () => {
    const count = await withTransaction(async (client) => {
      await client.query(`SELECT set_config('app.platform_admin', 'on', true)`);
      const result = await client.query('SELECT count(*)::int AS n FROM companies');
      return result.rows[0].n;
    });
    expect(count).toBe(2);
  });

  it('isolates stores by the transaction-local company context', async () => {
    const storeA = await seedStore({ companyId: companyA, name: 'فروشگاه آ' });
    const storeB = await seedStore({ companyId: companyB, name: 'فروشگاه ب' });

    const visibleA = await withTransaction(async (client) => {
      await client.query(`SELECT set_config('app.company_id', $1, true)`, [companyA]);
      await client.query(`SELECT set_config('app.user_id', $1, true)`, [userA]);
      const result = await client.query<{ id: string }>('SELECT id FROM stores ORDER BY id');
      return result.rows.map((row) => row.id);
    });
    expect(visibleA).toEqual([storeA]);

    const crossUpdate = await withTransaction(async (client) => {
      await client.query(`SELECT set_config('app.company_id', $1, true)`, [companyA]);
      const result = await client.query(
        `UPDATE stores SET name = 'hacked' WHERE id = $1`,
        [storeB],
      );
      return result.rowCount;
    });
    expect(crossUpdate).toBe(0);

    await expect(
      withTransaction(async (client) => {
        await client.query(`SELECT set_config('app.company_id', $1, true)`, [companyA]);
        await client.query(
          `INSERT INTO stores (company_id, name) VALUES ($1, 'forged')`,
          [companyB],
        );
      }),
    ).rejects.toThrow(/row-level security|policy/i);

    await expect(appPool.query('DELETE FROM stores')).rejects.toThrow(
      /permission denied/i,
    );
  });

  it('keeps the table owner subject to RLS (FORCE)', async () => {
    const result = await ownerPool.query('SELECT count(*)::int AS n FROM companies');
    expect(result.rows[0].n).toBe(0);
  });

  it('makes audit events append-only for every role', async () => {
    await withTransaction(async (client) => {
      await client.query(`SELECT set_config('app.company_id', $1, true)`, [companyA]);
      await client.query(
        `INSERT INTO audit_events (company_id, actor_type, action, entity_type)
         VALUES ($1, 'system', 'test.append', 'company')`,
        [companyA],
      );
    });

    await expect(
      appPool.query(`UPDATE audit_events SET action = 'changed'`),
    ).rejects.toThrow(/permission denied/i);
    await expect(appPool.query('DELETE FROM audit_events')).rejects.toThrow(
      /permission denied/i,
    );

    const trigger = await admin()
      .query(`UPDATE audit_events SET action = 'changed'`)
      .then(() => null)
      .catch((error: Error) => error.message);
    expect(trigger).toMatch(/append-only/);

    await expect(admin().query('DELETE FROM audit_events')).rejects.toThrow(/append-only/);
  });
});
