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
  seedUser,
  uniqueCode,
  uniqueMobile,
} from '../helpers/harness';

const ADMIN_PASSWORD = 'PlatformPass12345';

describe('Platform administrator separation and bootstrap (PH-1)', () => {
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
    await seedPlatformAdmin({ username: 'root.admin', password: ADMIN_PASSWORD });

    const response = await requestApp(app)
      .post('/api/v1/platform/auth/login')
      .send({ username: 'root.admin', password: ADMIN_PASSWORD })
      .expect(200);
    platformCookie = anyCookie(response, 'bz_platform_session');
  });

  it('uses a separate cookie scoped to the platform path', async () => {
    const response = await requestApp(app)
      .post('/api/v1/platform/auth/login')
      .send({ username: 'root.admin', password: ADMIN_PASSWORD })
      .expect(200);

    const header = response.headers['set-cookie'] as unknown as string[];
    const cookie = header.find((value) => value.startsWith('bz_platform_session='));
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/api/v1/platform');
    expect(JSON.stringify(response.body)).not.toContain(ADMIN_PASSWORD);

    await requestApp(app)
      .get('/api/v1/platform/auth/me')
      .set('Cookie', platformCookie)
      .expect(200);
  });

  it('does not accept a company session on platform routes', async () => {
    const mobile = uniqueMobile();
    const userId = await seedUser({ mobile, password: 'CompanyPass12345' });
    const company = await seedCompany({ code: uniqueCode('PLTC') });
    await seedMembership({ userId, companyId: company.companyId, role: 'manager' });
    const companySession = await login(app, mobile, 'CompanyPass12345');

    await requestApp(app)
      .get('/api/v1/platform/companies')
      .set('Cookie', companySession.cookie)
      .expect(401);

    await requestApp(app)
      .get('/api/v1/platform/auth/me')
      .set('Cookie', `${companySession.cookie}; bz_platform_session=${companySession.cookie.split('=')[1]}`)
      .expect(401);
  });

  it('does not accept a platform session on company routes', async () => {
    await requestApp(app)
      .get('/api/v1/company')
      .set('Cookie', platformCookie)
      .set('X-Company-Id', '11111111-1111-1111-1111-111111111111')
      .expect(401);

    await requestApp(app).get('/api/v1/me').set('Cookie', platformCookie).expect(401);
  });

  it('creates a company with an entitlement and a first manager', async () => {
    const code = uniqueCode('NEWCO');
    const mobile = uniqueMobile();

    const response = await requestApp(app)
      .post('/api/v1/platform/companies')
      .set('Cookie', platformCookie)
      .send({
        name: 'شرکت تازه',
        code,
        currency: 'IRR',
        maxStores: 7,
        managerMobile: mobile,
        managerFullName: 'مدیر نخست',
      })
      .expect(201);

    expect(response.body.data.company.code).toBe(code);
    expect(response.body.data.company.license.maxStores).toBe(7);
    expect(response.body.data.company.license.status).toBe('active');
    const inviteToken = response.body.data.manager.inviteToken as string;
    expect(typeof inviteToken).toBe('string');

    const membership = await admin().query<{ role_code: string }>(
      `SELECT m.role_code FROM company_memberships m
        JOIN users u ON u.id = m.user_id
       WHERE u.mobile = $1`,
      [mobile],
    );
    expect(membership.rows[0].role_code).toBe('manager');

    const audit = await admin().query(
      `SELECT 1 FROM audit_events
        WHERE action = 'platform.company.created' AND actor_type = 'platform_admin'`,
    );
    expect(audit.rowCount).toBe(1);

    // The invited manager can activate the account and sees the company.
    await requestApp(app)
      .post('/api/v1/auth/password/set')
      .send({ token: inviteToken, newPassword: 'FirstManager12345' })
      .expect(200);

    const managerSession = await login(app, mobile, 'FirstManager12345');
    const companyResponse = await requestApp(app)
      .get('/api/v1/company')
      .set('Cookie', managerSession.cookie)
      .set('X-Company-Id', response.body.data.company.id as string)
      .expect(200);
    expect(companyResponse.body.data.role).toBe('manager');
  });

  it('rejects duplicate company codes', async () => {
    const existing = await seedCompany({ code: uniqueCode('DUP') });
    const stored = await admin().query<{ code: string }>(
      'SELECT code FROM companies WHERE id = $1',
      [existing.companyId],
    );

    const response = await requestApp(app)
      .post('/api/v1/platform/companies')
      .set('Cookie', platformCookie)
      .send({
        name: 'شرکت تکراری',
        code: stored.rows[0].code,
        currency: 'IRR',
        maxStores: 2,
        managerMobile: uniqueMobile(),
        managerFullName: 'مدیر',
      })
      .expect(409);
    expect(response.body.error.code).toBe('COMPANY_CODE_TAKEN');
  });

  it('lists companies and updates the license with an audit trail', async () => {
    const created = await requestApp(app)
      .post('/api/v1/platform/companies')
      .set('Cookie', platformCookie)
      .send({
        name: 'شرکت مجوز',
        code: uniqueCode('LIC'),
        currency: 'IRR',
        maxStores: 3,
        managerMobile: uniqueMobile(),
        managerFullName: 'مدیر مجوز',
      })
      .expect(201);
    const companyId = created.body.data.company.id as string;

    const list = await requestApp(app)
      .get('/api/v1/platform/companies')
      .set('Cookie', platformCookie)
      .expect(200);
    expect(list.body.data.length).toBeGreaterThanOrEqual(1);

    const updated = await requestApp(app)
      .patch(`/api/v1/platform/companies/${companyId}/license`)
      .set('Cookie', platformCookie)
      .send({ maxStores: 9, status: 'suspended' })
      .expect(200);
    expect(updated.body.data.maxStores).toBe(9);
    expect(updated.body.data.status).toBe('suspended');
    expect(updated.body.data.validUntil).toBeNull();

    const audit = await admin().query(
      `SELECT 1 FROM audit_events
        WHERE action = 'platform.license.updated' AND company_id = $1`,
      [companyId],
    );
    expect(audit.rowCount).toBe(1);

    // The manager's company access is blocked while the license is suspended.
    const manager = await admin().query<{ mobile: string }>(
      `SELECT u.mobile FROM users u
        JOIN company_memberships m ON m.user_id = u.id
       WHERE m.company_id = $1 LIMIT 1`,
      [companyId],
    );
    const tempToken = 'license-test-token-123456';
    const user = await admin().query<{ id: string }>(
      'SELECT id FROM users WHERE mobile = $1',
      [manager.rows[0].mobile],
    );
    const { createHash } = await import('node:crypto');
    await admin().query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, created_by_type)
       VALUES ($1, $2, now() + interval '5 minutes', 'system')`,
      [user.rows[0].id, createHash('sha256').update(tempToken).digest('hex')],
    );
    await requestApp(app)
      .post('/api/v1/auth/password/set')
      .send({ token: tempToken, newPassword: 'LicenseUser12345' })
      .expect(200);
    const managerSession = await login(app, manager.rows[0].mobile, 'LicenseUser12345');

    const denied = await requestApp(app)
      .get('/api/v1/company')
      .set('Cookie', managerSession.cookie)
      .set('X-Company-Id', companyId)
      .expect(403);
    expect(denied.body.error.code).toBe('LICENSE_INACTIVE');
  });

  it('locks the platform account after repeated failures', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await requestApp(app)
        .post('/api/v1/platform/auth/login')
        .send({ username: 'root.admin', password: 'WrongPass12345' })
        .expect(401);
    }
    const locked = await requestApp(app)
      .post('/api/v1/platform/auth/login')
      .send({ username: 'root.admin', password: ADMIN_PASSWORD })
      .expect(423);
    expect(locked.body.error.code).toBe('AUTH_ACCOUNT_LOCKED');
  });

  it('has no public elevation endpoint for normal accounts', async () => {
    const mobile = uniqueMobile();
    const userId = await seedUser({ mobile, password: 'CompanyPass12345' });
    const company = await seedCompany({ code: uniqueCode('NOEL') });
    await seedMembership({ userId, companyId: company.companyId, role: 'manager' });
    const session = await login(app, mobile, 'CompanyPass12345');

    await requestApp(app)
      .post('/api/v1/platform/auth/login')
      .set('Cookie', session.cookie)
      .send({ username: 'root.admin', password: 'whatever12345' })
      .expect(401);
  });
});
