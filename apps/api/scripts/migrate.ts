import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { Pool } from 'pg';
import { getEnvironmentFilePaths } from '../src/config/env-paths.js';
import { parseEnvironment } from '../src/config/environment.js';
import { runMigrations } from '../src/database/migration-runner.js';

async function main(): Promise<void> {
  loadDotenv({ path: getEnvironmentFilePaths() });
  const environment = parseEnvironment(process.env);
  const pool = new Pool({ connectionString: environment.DATABASE_URL, max: 1 });
  const migrationsDirectory = fileURLToPath(new URL('../../../database/migrations', import.meta.url));

  try {
    const result = await runMigrations(pool, migrationsDirectory);
    const applied = result.applied.length;
    console.info(
      applied > 0
        ? `Applied ${applied} migration(s): ${result.applied.join(', ')}`
        : `No pending migrations (${result.alreadyApplied.length} already applied).`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('Migration failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
});
