import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Runs before every test module. Populates the same environment variables the
 * application reads in production; no secret is committed anywhere.
 */
const envFile = join(process.cwd(), '.data', 'test-env.json');
const values = JSON.parse(readFileSync(envFile, 'utf8')) as Record<string, string>;

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = values.DATABASE_URL;
process.env.DATABASE_OWNER_URL = values.DATABASE_OWNER_URL;
process.env.DATABASE_ADMIN_URL = values.DATABASE_ADMIN_URL;
process.env.DATABASE_ADMIN_DATABASE_URL = values.DATABASE_ADMIN_DATABASE_URL;
process.env.SESSION_TTL_HOURS = '12';
process.env.LOGIN_WINDOW_MINUTES = '15';
process.env.LOGIN_MAX_FAILURES_PHONE = '5';
process.env.LOGIN_MAX_FAILURES_IP = '100';
process.env.COOKIE_SECURE = 'false';
process.env.SUBSCRIPTION_GRACE_DAYS = '7';
process.env.WEB_ORIGIN = 'http://localhost:5173';
process.env.API_PORT = '3000';
