import { rmSync } from 'node:fs';
import { join } from 'node:path';
import type EmbeddedPostgres from 'embedded-postgres';

export default async function globalTeardown(): Promise<void> {
  const server = (globalThis as Record<string, unknown>).__BAZARIA_TEST_PG__ as
    | EmbeddedPostgres
    | undefined;

  if (server) {
    await server.stop().catch(() => undefined);
  }

  rmSync(join(process.cwd(), '.data', 'test-env.json'), { force: true });
  rmSync(join(process.cwd(), '.data', 'test-pg'), { recursive: true, force: true });
}
