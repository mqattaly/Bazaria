import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import * as dotenv from 'dotenv';
import { parseGraceDays } from '../subscription/subscription-policy';

const candidates = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../../.env'),
];
const envFile = candidates.find((file) => existsSync(file));
if (envFile) {
  dotenv.config({ path: envFile });
}

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== '' ? value : undefined;
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Environment variable ${name} must be a positive integer`);
  }
  return parsed;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw === 'true' || raw === '1';
}

const webOrigins = [
  optional('WEB_ORIGIN') ?? 'http://localhost:5173',
  ...(optional('WEB_ORIGINS_EXTRA') ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
];

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: process.env.NODE_ENV === 'production',
  apiPort: int('API_PORT', 3000),
  apiHost: optional('API_HOST') ?? '0.0.0.0',
  webOrigins,
  databaseUrl: optional('DATABASE_URL'),
  databaseOwnerUrl: optional('DATABASE_OWNER_URL'),
  databaseAdminUrl: optional('DATABASE_ADMIN_URL'),
  sessionTtlHours: int('SESSION_TTL_HOURS', 12),
  // Grace period after `valid_until`; zero disables it.
  subscriptionGraceDays: parseGraceDays(process.env.SUBSCRIPTION_GRACE_DAYS),
  loginWindowMinutes: int('LOGIN_WINDOW_MINUTES', 15),
  loginMaxFailuresPhone: int('LOGIN_MAX_FAILURES_PHONE', 5),
  loginMaxFailuresIp: int('LOGIN_MAX_FAILURES_IP', 20),
  cookieSecure: bool('COOKIE_SECURE', process.env.NODE_ENV === 'production'),
  // Set to the number of trusted reverse proxies (e.g. 1) in production so
  // req.ip reflects the client for throttling and audit records.
  trustProxy: optional('TRUST_PROXY'),
};

/**
 * CSRF origin allowlist. Production accepts only explicitly configured origins.
 * Development also accepts localhost and the sandbox preview domain so the
 * proxied web app can call the API without weakening production checks.
 */
export function isAllowedOrigin(origin: string): boolean {
  if (env.webOrigins.includes(origin)) return true;
  if (env.isProduction) return false;
  try {
    const hostname = new URL(origin).hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
    return hostname.endsWith('.e2b.app');
  } catch {
    return false;
  }
}

export function requireDatabaseUrl(): string {
  return env.databaseUrl ?? required('DATABASE_URL');
}

export function requireOwnerUrl(): string {
  return env.databaseOwnerUrl ?? required('DATABASE_OWNER_URL');
}

export function requireAdminUrl(): string {
  return env.databaseAdminUrl ?? required('DATABASE_ADMIN_URL');
}
