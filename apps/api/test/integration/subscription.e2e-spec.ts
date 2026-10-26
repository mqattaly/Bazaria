import type { INestApplication } from '@nestjs/common';
import {
  admin,
  anyCookie,
  closeAdminPool,
  closeApp,
  createApp,
  login,
  requestApp,
  resetDatabase,
  seedCompany,
  seedMembership,
  seedPlatformAdmin,
  seedStore,
  seedUser,
  uniqueCode,
  uniqueMobile,
} from '../helpers/harness';

const PASSWORD = 'SubPass12345';
const PLATFORM_PASSWORD = 'PlatformPass12345';
/** test/setup-env.ts pins SUBSCRIPTION_GRACE_DAYS to 7. */
const GRACE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function utcDateOnly(offsetDays: number): string {
  const now = new Date();
  const midnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return new Date(midnight + offsetDays * DAY_MS).toISOString().slice(0, 10);
}

interface CompanyAccess {
  companyId: string;
  cookie: string;
}

describe('Subscription cycle and write protection (PH-2)', () => {
  let app: INestApplication;
  let platformCookie: string;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await closeApp(app);
    await closeAdminPool();
  });

  beforeEach(async () => {
    await resetDatabase();
    await seedPlatformAdmin({ username: 'license.admin', password: PLATFORM_PASSWORD });
    platformCookie = await loginPlatform();
  });

  async function loginPlatform(): Promise<string> {
    const response = await requestApp(app)
      .post('/api/v1/platform/auth/login')
      .send({ username: 'license.admin', password: PLATFORM_PASSWORD })
      .expect(200);
    return anyCookie(response, 'bz_platform_session');
  }

  /** Seeds a company whose manager holds a session, and returns both. */
  async function seedTenant(options: {
    validUntil: string | null;
    licenseStatus?: 'active' | 'suspended';
    companyStatus?: 'active' | 'suspended';
  }): Promise<CompanyAccess> {
    const company = await seedCompany({
      code: uniqueCode('SUB'),
      validUntil: options.validUntil,
      licenseStatus: options.licenseStatus,
      status: options.companyStatus,
    });
    const mobile = uniqueMobile();
    const userId = await seedUser({ mobile, password: PASSWORD, fullName: 'مدیر اشتراک' });
    await seedMembership({ userId, companyId: company.companyId, role: 'manager' });
    const session = await login(app, mobile, PASSWORD);
    return { companyId: company.companyId, cookie: session.cookie };
  }

  function companyGet(access: CompanyAccess) {
    return requestApp(app)
      .get('/api/v1/company')
      .set('Cookie', access.cookie)
      .set('X-Company-Id', access.companyId);
  }

  function listStores(access: CompanyAccess) {
    return requestApp(app)
      .get('/api/v1/stores')
      .set('Cookie', access.cookie)
      .set('X-Company-Id', access.companyId);
  }

  function createStore(access: CompanyAccess) {
    return requestApp(app)
      .post('/api/v1/stores')
      .set('Cookie', access.cookie)
      .set('X-Company-Id', access.companyId)
      .send({ name: 'فروشگاه دوره اشتراک' });
  }

  function renew(companyId: string, days: unknown) {
    return requestApp(app)
      .post(`/api/v1/platform/companies/${companyId}/license/renew`)
      .set('Cookie', platformCookie)
      .send({ days });
  }

  it('keeps writes available while the license is valid', async () => {
    const access = await seedTenant({ validUntil: utcDateOnly(10) });

    const company = await companyGet(access).expect(200);
    expect(company.body.data.subscription).toMatchObject({
      state: 'active',
      writeAllowed: true,
      gracePeriodDays: GRACE_DAYS,
      validUntil: utcDateOnly(10),
    });
    expect(company.body.data.subscription.graceEndsAt).toBeTruthy();

    await createStore(access).expect(201);
  });

  it('allows writes during the grace period after the validity date', async () => {
    const access = await seedTenant({ validUntil: utcDateOnly(-3) });

    const company = await companyGet(access).expect(200);
    expect(company.body.data.subscription).toMatchObject({
      state: 'grace_period',
      writeAllowed: true,
      validUntil: utcDateOnly(-3),
    });
    // The date-only expiry stays valid until 00:00 UTC of the next day and the
    // grace period is added on top of that boundary.
    expect(company.body.data.subscription.graceEndsAt).toBe(
      new Date(
        Date.parse(`${utcDateOnly(-3)}T00:00:00.000Z`) +
          (1 + GRACE_DAYS) * DAY_MS,
      ).toISOString(),
    );

    await createStore(access).expect(201);
  });

  it('keeps reads available but blocks every tenant write once the grace period ends', async () => {
    const access = await seedTenant({ validUntil: utcDateOnly(-(GRACE_DAYS + 3)) });
    const storeId = await seedStore({ companyId: access.companyId });

    const company = await companyGet(access).expect(200);
    expect(company.body.data.subscription).toMatchObject({
      state: 'read_only',
      writeAllowed: false,
    });

    const list = await listStores(access).expect(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].id).toBe(storeId);

    const attempts = [
      await createStore(access).expect(403),
      await requestApp(app)
        .patch(`/api/v1/stores/${storeId}`)
        .set('Cookie', access.cookie)
        .set('X-Company-Id', access.companyId)
        .send({ name: 'تلاش ویرایش' })
        .expect(403),
      await requestApp(app)
        .patch(`/api/v1/stores/${storeId}/status`)
        .set('Cookie', access.cookie)
        .set('X-Company-Id', access.companyId)
        .send({ status: 'inactive' })
        .expect(403),
      await requestApp(app)
        .patch('/api/v1/company')
        .set('Cookie', access.cookie)
        .set('X-Company-Id', access.companyId)
        .send({ name: 'نام جدید' })
        .expect(403),
      await requestApp(app)
        .post('/api/v1/memberships')
        .set('Cookie', access.cookie)
        .set('X-Company-Id', access.companyId)
        .send({ mobile: uniqueMobile(), fullName: 'کاربر جدید', role: 'sales_representative' })
        .expect(403),
    ];

    for (const attempt of attempts) {
      expect(attempt.body.error.code).toBe('COMPANY_SUBSCRIPTION_READ_ONLY');
      expect(attempt.body.error.message).toMatch(/[\u0600-\u06FF]/);
      expect(attempt.body.error.meta).toMatchObject({
        subscriptionState: 'read_only',
        writeAllowed: false,
      });
      expect(JSON.stringify(attempt.body)).not.toContain(access.companyId);
      expect(JSON.stringify(attempt.body)).not.toContain(PASSWORD);
    }

    // Nothing was written and the block itself is recorded as a security event.
    const stored = await admin().query<{ status: string; name: string }>(
      'SELECT status, name FROM stores WHERE id = $1',
      [storeId],
    );
    expect(stored.rows[0].status).toBe('active');
    expect(stored.rows[0].name).toBe('فروشگاه آزمایشی');

    const events = await admin().query(
      `SELECT 1 FROM security_events WHERE event_type = 'subscription.write_blocked'`,
    );
    expect(events.rowCount).toBeGreaterThanOrEqual(1);
  });

  it('never locks authentication, logout or security-essential operations', async () => {
    const access = await seedTenant({ validUntil: utcDateOnly(-(GRACE_DAYS + 5)) });
    const memberships = await admin().query<{ id: string }>(
      'SELECT id FROM company_memberships WHERE company_id = $1 LIMIT 1',
      [access.companyId],
    );

    const fresh = await login(app, await managerMobile(access.companyId), PASSWORD);
    expect(fresh.cookie).toBeTruthy();

    await requestApp(app)
      .post('/api/v1/auth/password/change')
      .set('Cookie', fresh.cookie)
      .send({ currentPassword: PASSWORD, newPassword: 'SubPass123456' })
      .expect(200);

    // Re-issued credentials still work while the tenant is read-only.
    const relogin = await login(app, await managerMobile(access.companyId), 'SubPass123456');
    await requestApp(app)
      .get('/api/v1/company')
      .set('Cookie', relogin.cookie)
      .set('X-Company-Id', access.companyId)
      .expect(200);

    // The dual-control password reset for a member is exempt as well, while
    // adding a member remains blocked by the subscription policy.
    await requestApp(app)
      .post(`/api/v1/memberships/${memberships.rows[0].id}/password-reset`)
      .set('Cookie', relogin.cookie)
      .set('X-Company-Id', access.companyId)
      .expect(200);

    await requestApp(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', relogin.cookie)
      .expect(200);

    await requestApp(app)
      .get('/api/v1/company')
      .set('Cookie', relogin.cookie)
      .set('X-Company-Id', access.companyId)
      .expect(401);
  });

  it('leaves platform endpoints usable while a tenant is read-only', async () => {
    const access = await seedTenant({ validUntil: utcDateOnly(-(GRACE_DAYS + 2)) });

    await requestApp(app)
      .get('/api/v1/platform/auth/me')
      .set('Cookie', platformCookie)
      .expect(200);

    const list = await requestApp(app)
      .get('/api/v1/platform/companies')
      .set('Cookie', platformCookie)
      .expect(200);
    const listed = list.body.data.find(
      (row: { id: string }) => row.id === access.companyId,
    );
    expect(listed.license.subscription.state).toBe('read_only');

    // Changing the license itself is a platform operation and stays available.
    await requestApp(app)
      .patch(`/api/v1/platform/companies/${access.companyId}/license`)
      .set('Cookie', platformCookie)
      .send({ maxStores: 5 })
      .expect(200);
  });

  it('restores write access through the platform renewal without a new login', async () => {
    const access = await seedTenant({ validUntil: utcDateOnly(-(GRACE_DAYS + 2)) });
    await createStore(access).expect(403);

    const renewed = await renew(access.companyId, 30).expect(200);
    expect(renewed.body.data.validUntil).toBe(utcDateOnly(30));
    expect(renewed.body.data.subscription).toMatchObject({
      state: 'active',
      writeAllowed: true,
    });

    // The existing manager session immediately regains write access.
    await createStore(access).expect(201);
    const company = await companyGet(access).expect(200);
    expect(company.body.data.subscription.state).toBe('active');

    const audit = await admin().query<{
      details: { before: { validUntil: string }; after: { validUntil: string }; days: number };
    }>(
      `SELECT details FROM audit_events
        WHERE company_id = $1 AND action = 'platform.license.renewed'
        ORDER BY id DESC LIMIT 1`,
      [access.companyId],
    );
    expect(audit.rowCount).toBe(1);
    expect(audit.rows[0].details.before.validUntil).toBe(
      utcDateOnly(-(GRACE_DAYS + 2)),
    );
    expect(audit.rows[0].details.after.validUntil).toBe(utcDateOnly(30));
    expect(audit.rows[0].details.days).toBe(30);
  });

  it('extends a still-valid license from its current expiry, not from today', async () => {
    const access = await seedTenant({ validUntil: utcDateOnly(5) });

    const renewed = await renew(access.companyId, 10).expect(200);
    expect(renewed.body.data.validUntil).toBe(utcDateOnly(15));
  });

  it('validates renewal input and refuses meaningless renewals', async () => {
    const readOnly = await seedTenant({ validUntil: utcDateOnly(-(GRACE_DAYS + 2)) });

    for (const days of [0, -1, 3651, 'many', 1.5]) {
      const response = await renew(readOnly.companyId, days).expect(422);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }

    const suspended = await seedTenant({
      validUntil: utcDateOnly(30),
      licenseStatus: 'suspended',
    });
    const suspendedRenewal = await renew(suspended.companyId, 30).expect(409);
    expect(suspendedRenewal.body.error.code).toBe('STATE_CONFLICT');

    const perpetual = await seedTenant({ validUntil: null });
    const perpetualRenewal = await renew(perpetual.companyId, 30).expect(409);
    expect(perpetualRenewal.body.error.code).toBe('STATE_CONFLICT');

    await renew('00000000-0000-4000-8000-000000000000', 30).expect(404);
    await renew('not-a-uuid', 30).expect(404);
  });

  it('gives company users no way to change their own expiry', async () => {
    const access = await seedTenant({ validUntil: utcDateOnly(-(GRACE_DAYS + 2)) });

    // A tenant session is not a platform session, even on the renewal route.
    const asTenant = await requestApp(app)
      .post(`/api/v1/platform/companies/${access.companyId}/license/renew`)
      .set('Cookie', access.cookie)
      .send({ days: 365 })
      .expect(401);
    expect(asTenant.body.error.code).toBe('AUTH_REQUIRED');

    await requestApp(app)
      .patch(`/api/v1/platform/companies/${access.companyId}/license`)
      .set('Cookie', access.cookie)
      .send({ validUntil: utcDateOnly(365) })
      .expect(401);

    // The tenant contract exposes no expiry field at all: it is rejected as an
    // unknown property instead of being silently ignored (checked on an active
    // tenant so the subscription policy is not what rejects the request).
    const activeTenant = await seedTenant({ validUntil: utcDateOnly(30) });
    const rejected = await requestApp(app)
      .patch('/api/v1/company')
      .set('Cookie', activeTenant.cookie)
      .set('X-Company-Id', activeTenant.companyId)
      .send({ validUntil: utcDateOnly(365) })
      .expect(422);
    expect(rejected.body.error.code).toBe('VALIDATION_ERROR');

    await requestApp(app)
      .post('/api/v1/license/renew')
      .set('Cookie', access.cookie)
      .set('X-Company-Id', access.companyId)
      .send({ days: 365 })
      .expect(404);

    const license = await requestApp(app)
      .get('/api/v1/license')
      .set('Cookie', access.cookie)
      .set('X-Company-Id', access.companyId)
      .expect(200);
    expect(license.body.data.validUntil).toBe(utcDateOnly(-(GRACE_DAYS + 2)));
    expect(license.body.data.subscription.state).toBe('read_only');
  });

  it('cannot be escaped with a spoofed company header or a foreign company', async () => {
    const expired = await seedTenant({ validUntil: utcDateOnly(-(GRACE_DAYS + 2)) });
    const active = await seedTenant({ validUntil: utcDateOnly(20) });

    const spoofed = await requestApp(app)
      .post('/api/v1/stores')
      .set('Cookie', expired.cookie)
      .set('X-Company-Id', active.companyId)
      .send({ name: 'فروشگاه جعلی' })
      .expect(403);
    expect(spoofed.body.error.code).toBe('COMPANY_ACCESS_DENIED');
    expect(JSON.stringify(spoofed.body)).not.toContain('اشتراک');

    const ownHeader = await requestApp(app)
      .post('/api/v1/stores')
      .set('Cookie', expired.cookie)
      .set('X-Company-Id', expired.companyId)
      .send({ name: 'فروشگاه خودی' })
      .expect(403);
    expect(ownHeader.body.error.code).toBe('COMPANY_SUBSCRIPTION_READ_ONLY');

    const missingHeader = await requestApp(app)
      .get('/api/v1/stores')
      .set('Cookie', expired.cookie)
      .expect(400);
    expect(missingHeader.body.error.code).toBe('COMPANY_CONTEXT_REQUIRED');

    // A suspended company still fails the Phase 1 access check, not the
    // subscription write policy, and its data stays untouched.
    const suspended = await seedTenant({
      validUntil: utcDateOnly(30),
      licenseStatus: 'suspended',
    });
    const denied = await requestApp(app)
      .get('/api/v1/stores')
      .set('Cookie', suspended.cookie)
      .set('X-Company-Id', suspended.companyId)
      .expect(403);
    expect(denied.body.error.code).toBe('LICENSE_INACTIVE');

    const counts = await admin().query<{ count: string }>('SELECT count(*) FROM stores');
    expect(Number(counts.rows[0].count)).toBe(0);
  });
});

async function managerMobile(companyId: string): Promise<string> {
  const result = await admin().query<{ mobile: string }>(
    `SELECT u.mobile FROM users u
       JOIN company_memberships m ON m.user_id = u.id
      WHERE m.company_id = $1 AND m.role_code = 'manager'
      LIMIT 1`,
    [companyId],
  );
  return result.rows[0].mobile;
}
