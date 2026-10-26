import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import * as argon2 from 'argon2';
import request from 'supertest';
import type { RoleCode } from '@bazaria/shared';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { SESSION_COOKIE_NAME } from '@bazaria/shared';

let adminPool: Pool | undefined;

export function admin(): Pool {
  if (!adminPool) {
    adminPool = new Pool({ connectionString: process.env.DATABASE_ADMIN_URL, max: 4 });
  }
  return adminPool;
}

export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { logger: ['error'] });
  configureApp(app);
  await app.init();
  return app;
}

export async function closeApp(app: INestApplication): Promise<void> {
  await app.close();
}

export async function resetDatabase(): Promise<void> {
  await admin().query(`
    TRUNCATE stores, audit_events, security_events, password_reset_tokens,
             sessions, platform_sessions, company_memberships,
             company_entitlements, companies, users, platform_admins
    RESTART IDENTITY CASCADE
  `);
}

export async function closeAdminPool(): Promise<void> {
  if (adminPool) {
    await adminPool.end();
    adminPool = undefined;
  }
}

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

export interface UserFixture {
  mobile: string;
  fullName?: string;
  password?: string | null;
  status?: 'active' | 'inactive';
}

export async function seedUser(fixture: UserFixture): Promise<string> {
  const hash = fixture.password ? await hashPassword(fixture.password) : null;
  const result = await admin().query<{ id: string }>(
    `INSERT INTO users (mobile, full_name, password_hash, status)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [
      fixture.mobile,
      fixture.fullName ?? 'کاربر آزمایشی',
      hash,
      fixture.status ?? 'active',
    ],
  );
  return result.rows[0].id;
}

export interface CompanyFixture {
  code: string;
  name?: string;
  currency?: string;
  maxStores?: number;
  status?: 'active' | 'suspended';
  licenseStatus?: 'active' | 'suspended';
  validUntil?: string | null;
}

export async function seedCompany(
  fixture: CompanyFixture,
): Promise<{ companyId: string }> {
  const result = await admin().query<{ id: string }>(
    `INSERT INTO companies (name, code, currency, status)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [
      fixture.name ?? `شرکت ${fixture.code}`,
      fixture.code,
      fixture.currency ?? 'IRR',
      fixture.status ?? 'active',
    ],
  );
  const companyId = result.rows[0].id;
  await admin().query(
    `INSERT INTO company_entitlements (company_id, status, max_stores, valid_until)
     VALUES ($1, $2, $3, $4::date)`,
    [
      companyId,
      fixture.licenseStatus ?? 'active',
      fixture.maxStores ?? 3,
      fixture.validUntil ?? null,
    ],
  );
  return { companyId };
}

export interface StoreFixture {
  companyId: string;
  name?: string;
  contactName?: string | null;
  contactMobile?: string | null;
  address?: string | null;
  note?: string | null;
  status?: 'active' | 'inactive';
  createdByUserId?: string | null;
}

export async function seedStore(fixture: StoreFixture): Promise<string> {
  const result = await admin().query<{ id: string }>(
    `INSERT INTO stores
       (company_id, name, contact_name, contact_mobile, address, note, status,
        created_by_user_id, updated_by_user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
     RETURNING id`,
    [
      fixture.companyId,
      fixture.name ?? 'فروشگاه آزمایشی',
      fixture.contactName ?? null,
      fixture.contactMobile ?? null,
      fixture.address ?? null,
      fixture.note ?? null,
      fixture.status ?? 'active',
      fixture.createdByUserId ?? null,
    ],
  );
  return result.rows[0].id;
}

export async function seedMembership(input: {
  userId: string;
  companyId: string;
  role: RoleCode;
  status?: 'active' | 'inactive';
}): Promise<string> {
  const result = await admin().query<{ id: string }>(
    `INSERT INTO company_memberships (user_id, company_id, role_code, status)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [input.userId, input.companyId, input.role, input.status ?? 'active'],
  );
  return result.rows[0].id;
}

export async function seedPlatformAdmin(input: {
  username: string;
  password: string;
  fullName?: string;
  status?: 'active' | 'inactive';
}): Promise<string> {
  const hash = await hashPassword(input.password);
  const result = await admin().query<{ id: string }>(
    `INSERT INTO platform_admins (username, full_name, password_hash, status)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [
      input.username,
      input.fullName ?? 'مدیر پلتفرم آزمایشی',
      hash,
      input.status ?? 'active',
    ],
  );
  return result.rows[0].id;
}

export function requestApp(app: INestApplication) {
  return request(app.getHttpServer());
}

export function sessionCookie(response: request.Response): string {
  const header = response.headers['set-cookie'];
  const cookies = Array.isArray(header) ? header : header ? [header] : [];
  const session = cookies.find((cookie) => cookie.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!session) throw new Error('Session cookie was not set');
  return session.split(';')[0];
}

export function anyCookie(response: request.Response, name: string): string {
  const header = response.headers['set-cookie'];
  const cookies = Array.isArray(header) ? header : header ? [header] : [];
  const found = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  if (!found) throw new Error(`Cookie ${name} was not set`);
  return found.split(';')[0];
}

export async function login(
  app: INestApplication,
  mobile: string,
  password: string,
): Promise<{ cookie: string; body: Record<string, unknown> }> {
  const response = await requestApp(app)
    .post('/api/v1/auth/login')
    .send({ mobile, password })
    .expect(200);
  return { cookie: sessionCookie(response), body: response.body as Record<string, unknown> };
}

export function uniqueCode(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

export function uniqueMobile(): string {
  const digits = Math.floor(Math.random() * 1_000_000_000)
    .toString()
    .padStart(9, '0');
  return `+989${digits}`;
}
