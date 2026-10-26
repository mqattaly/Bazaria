import { Client } from 'pg';
import { admin, closeAdminPool } from '../helpers/harness';
import { runMigrations } from '../../src/db/migrations';
import { urlWithDatabase } from '../../scripts/db-utils';

describe('Versioned migrations (PH-1, PH-2)', () => {
  afterAll(async () => {
    await closeAdminPool();
  });

  it('is idempotent on the current database', async () => {
    const result = await runMigrations(process.env.DATABASE_OWNER_URL as string);
    expect(result.applied).toEqual([]);
    expect(result.alreadyApplied).toEqual(
      expect.arrayContaining([
        '001_phase1_foundation.sql',
        '002_phase2_stores.sql',
      ]),
    );
  });

  it('applies from an empty database and detects edited migrations', async () => {
    const databaseName = `bazaria_mig_${Date.now().toString(36)}`;
    await admin().query(`CREATE DATABASE ${databaseName} OWNER bazaria_owner`);
    const ownerUrl = urlWithDatabase(
      process.env.DATABASE_OWNER_URL as string,
      databaseName,
    );

    try {
      const first = await runMigrations(ownerUrl);
      expect(first.applied).toEqual([
        '001_phase1_foundation.sql',
        '002_phase2_stores.sql',
      ]);

      const client = new Client({ connectionString: ownerUrl });
      await client.connect();
      try {
        const tables = await client.query<{ table_name: string }>(
          `SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name`,
        );
        const names = tables.rows.map((row) => row.table_name);
        expect(names).toEqual(
          expect.arrayContaining([
            'users',
            'sessions',
            'platform_admins',
            'companies',
            'company_entitlements',
            'company_memberships',
            'audit_events',
            'security_events',
            'stores',
            'schema_migrations',
          ]),
        );

        const forced = await client.query<{ relname: string }>(
          `SELECT relname FROM pg_class
            WHERE relnamespace = 'public'::regnamespace
              AND relforcerowsecurity = true
            ORDER BY relname`,
        );
        expect(forced.rows.map((row) => row.relname)).toEqual(
          expect.arrayContaining([
            'audit_events',
            'companies',
            'company_entitlements',
            'company_memberships',
            'stores',
          ]),
        );

        await client.query(
          `UPDATE schema_migrations SET checksum = 'tampered' WHERE version = '001_phase1_foundation.sql'`,
        );
      } finally {
        await client.end();
      }

      await expect(runMigrations(ownerUrl)).rejects.toThrow(/checksum mismatch/i);
    } finally {
      await admin().query(`DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`);
    }
  });
});
