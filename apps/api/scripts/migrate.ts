import { requireOwnerUrl } from '../src/config/env';
import { runMigrations } from '../src/db/migrations';

async function main(): Promise<void> {
  const result = await runMigrations(requireOwnerUrl());
  for (const file of result.alreadyApplied) {
    console.log(`= ${file} (already applied)`);
  }
  for (const file of result.applied) {
    console.log(`+ ${file} (applied)`);
  }
  console.log(
    `Migrations complete: ${result.applied.length} applied, ${result.alreadyApplied.length} already applied`,
  );
}

main().catch((error: unknown) => {
  console.error(`Migration failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
