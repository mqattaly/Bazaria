/**
 * Local development PostgreSQL server.
 *
 * Uses real PostgreSQL binaries distributed via npm because the sandbox image
 * has no system PostgreSQL and no Docker. This script is development-only: it
 * boots a throwaway cluster inside `.data/` and keeps it running in the
 * foreground. Production environments receive a normal managed PostgreSQL URL.
 *
 * Usage: `npm run db:start`
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import 'dotenv/config';
import EmbeddedPostgres from 'embedded-postgres';

const databaseDir = join(process.cwd(), '.data', 'pg');
const port = Number(process.env.PG_DEV_PORT ?? 5433);

const adminUrl = process.env.DATABASE_ADMIN_URL;
if (!adminUrl) {
  console.error(
    '[dev-db] DATABASE_ADMIN_URL is required. Copy .env.example to .env and set a local password.',
  );
  process.exit(1);
}

let adminUser = 'postgres';
let adminPassword = '';
try {
  const parsed = new URL(adminUrl);
  adminUser = decodeURIComponent(parsed.username) || 'postgres';
  adminPassword = decodeURIComponent(parsed.password);
  if (parsed.port && Number(parsed.port) !== port) {
    console.error(
      `[dev-db] DATABASE_ADMIN_URL port ${parsed.port} does not match PG_DEV_PORT ${port}.`,
    );
    process.exit(1);
  }
} catch {
  console.error('[dev-db] DATABASE_ADMIN_URL is not a valid PostgreSQL URL.');
  process.exit(1);
}

if (!adminPassword || /^YOUR_|^replace-with/i.test(adminPassword)) {
  console.error(
    '[dev-db] DATABASE_ADMIN_URL must contain a real local password (placeholder detected).',
  );
  process.exit(1);
}

mkdirSync(dirname(databaseDir), { recursive: true });

const server = new EmbeddedPostgres({
  databaseDir,
  user: adminUser,
  password: adminPassword,
  port,
  persistent: true,
});

await server.initialise();
await server.start();
try {
  await server.createDatabase('bazaria');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (!/already exists/i.test(message)) throw error;
}

console.log(`[dev-db] PostgreSQL 18 listening on 127.0.0.1:${port}`);
console.log('[dev-db] bootstrap: npm run db:bootstrap && npm run db:migrate');

const shutdown = async () => {
  await server.stop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Keep the cluster process alive; embedded-postgres owns the child server.
await new Promise(() => {});
