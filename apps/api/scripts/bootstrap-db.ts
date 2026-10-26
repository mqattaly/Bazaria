import { requireAdminUrl } from '../src/config/env';
import { bootstrapDatabase, databaseNameFromUrl } from './db-utils';

async function main(): Promise<void> {
  const adminUrl = requireAdminUrl();
  const ownerPassword = process.env.DB_OWNER_PASSWORD;
  const appPassword = process.env.DB_APP_PASSWORD;

  if (!ownerPassword || !appPassword) {
    throw new Error('DB_OWNER_PASSWORD and DB_APP_PASSWORD are required');
  }
  if (/^(YOUR_|replace-with)/i.test(ownerPassword) || /^(YOUR_|replace-with)/i.test(appPassword)) {
    throw new Error('DB_OWNER_PASSWORD and DB_APP_PASSWORD still contain placeholders');
  }

  const databaseName = databaseNameFromUrl(process.env.DATABASE_URL ?? adminUrl);

  await bootstrapDatabase({ adminUrl, databaseName, ownerPassword, appPassword });
  console.log(
    `Database bootstrap complete: ${databaseName} (roles ${'bazaria_owner'}, bazaria_app)`,
  );
}

main().catch((error: unknown) => {
  console.error(`Bootstrap failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
