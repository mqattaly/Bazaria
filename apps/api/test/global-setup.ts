import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import EmbeddedPostgres from 'embedded-postgres';
import { bootstrapDatabase, urlWithDatabase } from '../scripts/db-utils';
import { runMigrations } from '../src/db/migrations';

const TEST_DATABASE = 'bazaria_test';

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (typeof address === 'object' && address) {
        const { port } = address;
        server.close(() => resolve(port));
      } else {
        server.close(() => reject(new Error('Could not allocate a port')));
      }
    });
  });
}

/**
 * Boots a real PostgreSQL 18 cluster (npm-distributed binaries), creates the
 * migration role and the runtime role, and applies migrations. Tests therefore
 * run against the same role separation and RLS policies as production.
 */
export default async function globalSetup(): Promise<void> {
  const dataRoot = join(process.cwd(), '.data');
  const databaseDir = join(dataRoot, 'test-pg');
  mkdirSync(dataRoot, { recursive: true });
  rmSync(databaseDir, { recursive: true, force: true });
  rmSync(join(dataRoot, 'test-env.json'), { force: true });

  const port = await freePort();
  const adminPassword = randomBytes(18).toString('base64url');
  const ownerPassword = randomBytes(18).toString('base64url');
  const appPassword = randomBytes(18).toString('base64url');

  const server = new EmbeddedPostgres({
    databaseDir,
    user: 'postgres',
    password: adminPassword,
    port,
    persistent: false,
  });

  await server.initialise();
  await server.start();
  await server.createDatabase(TEST_DATABASE);

  const host = `127.0.0.1:${port}`;
  const adminUrl = `postgres://postgres:${encodeURIComponent(adminPassword)}@${host}/${TEST_DATABASE}`;

  await bootstrapDatabase({
    adminUrl,
    databaseName: TEST_DATABASE,
    ownerPassword,
    appPassword,
  });

  const ownerUrl = `postgres://bazaria_owner:${encodeURIComponent(ownerPassword)}@${host}/${TEST_DATABASE}`;
  const appUrl = `postgres://bazaria_app:${encodeURIComponent(appPassword)}@${host}/${TEST_DATABASE}`;

  await runMigrations(ownerUrl);

  writeFileSync(
    join(dataRoot, 'test-env.json'),
    JSON.stringify(
      {
        DATABASE_URL: appUrl,
        DATABASE_OWNER_URL: ownerUrl,
        DATABASE_ADMIN_URL: adminUrl,
        DATABASE_ADMIN_DATABASE_URL: urlWithDatabase(adminUrl, 'postgres'),
        TEST_PG_PORT: port,
        TEST_PG_DATA_DIR: databaseDir,
      },
      null,
      2,
    ),
  );

  (globalThis as Record<string, unknown>).__BAZARIA_TEST_PG__ = server;
}
