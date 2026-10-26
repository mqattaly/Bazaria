import { Client } from 'pg';

export const OWNER_ROLE = 'bazaria_owner';
export const APP_ROLE = 'bazaria_app';

const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

export function databaseNameFromUrl(url: string): string {
  const parsed = new URL(url);
  const name = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (!SAFE_IDENTIFIER.test(name)) {
    throw new Error('Database name must contain only lowercase letters, digits and underscores');
  }
  return name;
}

export function urlWithDatabase(url: string, database: string): string {
  if (!SAFE_IDENTIFIER.test(database)) {
    throw new Error('Unsafe database name');
  }
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export async function withClient<T>(
  connectionString: string,
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function ensureRole(
  admin: Client,
  name: string,
  password: string,
): Promise<void> {
  const exists = await admin.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [name]);
  if (exists.rowCount === 0) {
    await admin.query(`CREATE ROLE ${name} LOGIN`);
  }
  // Always reset the attributes and password; idempotent and least-privilege.
  await admin.query(
    `ALTER ROLE ${name} WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD ${sqlLiteral(password)}`,
  );
}

export interface BootstrapOptions {
  adminUrl: string;
  databaseName: string;
  ownerPassword: string;
  appPassword: string;
}

/**
 * Creates the two database login roles and the application database.
 * The migration/owner role owns the schema; the runtime role gets no DDL and
 * is neither superuser nor BYPASSRLS.
 */
export async function bootstrapDatabase(options: BootstrapOptions): Promise<void> {
  if (!SAFE_IDENTIFIER.test(options.databaseName)) {
    throw new Error('Unsafe database name');
  }
  if (options.ownerPassword.length < 12 || options.appPassword.length < 12) {
    throw new Error('Database role passwords must be at least 12 characters');
  }

  await withClient(urlWithDatabase(options.adminUrl, 'postgres'), async (admin) => {
    await ensureRole(admin, OWNER_ROLE, options.ownerPassword);
    await ensureRole(admin, APP_ROLE, options.appPassword);

    const database = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      options.databaseName,
    ]);
    if (database.rowCount === 0) {
      await admin.query(
        `CREATE DATABASE ${options.databaseName} OWNER ${OWNER_ROLE} ENCODING 'UTF8'`,
      );
    }

    await admin.query(
      `REVOKE CONNECT ON DATABASE ${options.databaseName} FROM PUBLIC`,
    );
    // The owner keeps DDL rights even if the database was provisioned by a
    // managed service; the runtime role never gets CREATE.
    await admin.query(
      `GRANT CONNECT, CREATE ON DATABASE ${options.databaseName} TO ${OWNER_ROLE}`,
    );
    await admin.query(
      `GRANT CONNECT ON DATABASE ${options.databaseName} TO ${APP_ROLE}`,
    );
  });

  await withClient(
    urlWithDatabase(options.adminUrl, options.databaseName),
    async (admin) => {
      // Guarantee the migration role can create objects in `public` on every
      // supported PostgreSQL version.
      await admin.query(`ALTER SCHEMA public OWNER TO ${OWNER_ROLE}`);
      await admin.query(`GRANT ALL ON SCHEMA public TO ${OWNER_ROLE}`);
      await admin.query(`GRANT USAGE ON SCHEMA public TO ${APP_ROLE}`);
    },
  );
}
