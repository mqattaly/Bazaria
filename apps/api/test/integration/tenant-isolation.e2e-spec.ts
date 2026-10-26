import type { INestApplication } from '@nestjs/common';
import {
  admin,
  closeAdminPool,
  closeApp,
  createApp,
  login,
  requestApp,
  resetDatabase,
  seedCompany,
  seedMembership,
  seedUser,
  uniqueCode,
  uniqueMobile,
} from '../helpers/harness';

const PASSWORD = 'TenantPass12345';

describe('Multi-company membership and tenant isolation (PH-1)', () => {
  let app: INestApplication;
  let companyA: string;
  let companyB: string;
  let userOne: string;
  let userTwo: string;
  let cookieOne: string;
  let cookieTwo: string;
  let mobileOne: string;
  let mobileTwo: string;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await closeApp(app);
    await closeAdminPool();
  });

  beforeEach(async () => {
    await resetDatabase();

    const a = await seedCompany({
      code: uniqueCode('TENA'),
      name: 'شرکت الف',
      maxStores: 4,
    });
    const b = await seedCompany({
      code: uniqueCode('TENB'),
      name: 'شرکت ب',
      maxStores: 2,
    });
    companyA = a.companyId;
    companyB = b.companyId;

    mobileOne = uniqueMobile();
    mobileTwo = uniqueMobile();
    userOne = await seedUser({
      mobile: mobileOne,
      password: PASSWORD,
      fullName: 'کاربر دوشرکتی',
    });
    userTwo = await seedUser({
      mobile: mobileTwo,
      password: PASSWORD,
      fullName: 'کاربر انبار',
    });

    await seedMembership({ userId: userOne, companyId: companyA, role: 'manager' });
    await seedMembership({
      userId: userOne,
      companyId: companyB,
      role: 'sales_representative',
    });
    await seedMembership({ userId: userTwo, companyId: companyA, role: 'warehouse_user' });

    const sessionOne = await login(app, mobileOne, PASSWORD);
    const sessionTwo = await login(app, mobileTwo, PASSWORD);
    cookieOne = sessionOne.cookie;
    cookieTwo = sessionTwo.cookie;
  });

  it('lists memberships with the role held in each company', async () => {
    const response = await requestApp(app)
      .get('/api/v1/me/companies')
      .set('Cookie', cookieOne)
      .expect(200);

    const companies = response.body.data as Array<{
      id: string;
      role: string;
      status: string;
    }>;
    expect(companies).toHaveLength(2);
    expect(companies.find((company) => company.id === companyA)?.role).toBe('manager');
    expect(companies.find((company) => company.id === companyB)?.role).toBe(
      'sales_representative',
    );
  });

  it('returns only the selected company and its role', async () => {
    const response = await requestApp(app)
      .get('/api/v1/company')
      .set('Cookie', cookieOne)
      .set('X-Company-Id', companyA)
      .expect(200);

    expect(response.body.data.id).toBe(companyA);
    expect(response.body.data.name).toBe('شرکت الف');
    expect(response.body.data.role).toBe('manager');
    expect(response.body.data.permissions).toContain('membership.manage');

    const other = await requestApp(app)
      .get('/api/v1/company')
      .set('Cookie', cookieOne)
      .set('X-Company-Id', companyB)
      .expect(200);
    expect(other.body.data.id).toBe(companyB);
    expect(other.body.data.role).toBe('sales_representative');
    expect(other.body.data.permissions).not.toContain('membership.manage');
  });

  it('denies a forged company id without disclosing that it exists', async () => {
    const foreign = await seedCompany({ code: uniqueCode('TENF'), name: 'شرکت دیگر' });

    const response = await requestApp(app)
      .get('/api/v1/company')
      .set('Cookie', cookieOne)
      .set('X-Company-Id', foreign.companyId)
      .expect(403);

    expect(response.body.error.code).toBe('COMPANY_ACCESS_DENIED');
    expect(JSON.stringify(response.body)).not.toContain('شرکت دیگر');

    const deniedAudit = await admin().query(
      `SELECT 1 FROM security_events WHERE event_type = 'authz.company_access_denied'`,
    );
    expect(deniedAudit.rowCount).toBeGreaterThan(0);
  });

  it('rejects missing and malformed company context', async () => {
    const missing = await requestApp(app)
      .get('/api/v1/company')
      .set('Cookie', cookieOne)
      .expect(400);
    expect(missing.body.error.code).toBe('COMPANY_CONTEXT_REQUIRED');

    const malformed = await requestApp(app)
      .get('/api/v1/company')
      .set('Cookie', cookieOne)
      .set('X-Company-Id', 'not-a-uuid')
      .expect(403);
    expect(malformed.body.error.code).toBe('COMPANY_ACCESS_DENIED');
  });

  it('keeps a role from one company from granting access in another', async () => {
    const patch = await requestApp(app)
      .patch('/api/v1/company')
      .set('Cookie', cookieOne)
      .set('X-Company-Id', companyB)
      .send({ name: 'نام تغییر یافته' })
      .expect(403);
    expect(patch.body.error.code).toBe('PERMISSION_DENIED');

    const memberships = await requestApp(app)
      .get('/api/v1/memberships')
      .set('Cookie', cookieOne)
      .set('X-Company-Id', companyB)
      .expect(403);
    expect(memberships.body.error.code).toBe('PERMISSION_DENIED');

    const allowed = await requestApp(app)
      .patch('/api/v1/company')
      .set('Cookie', cookieOne)
      .set('X-Company-Id', companyA)
      .send({ name: 'نام تغییر یافته' })
      .expect(200);
    expect(allowed.body.data.name).toBe('نام تغییر یافته');
  });

  it('applies warehouse restrictions server-side', async () => {
    await requestApp(app)
      .get('/api/v1/company')
      .set('Cookie', cookieTwo)
      .set('X-Company-Id', companyA)
      .expect(200);

    await requestApp(app)
      .patch('/api/v1/company')
      .set('Cookie', cookieTwo)
      .set('X-Company-Id', companyA)
      .send({ name: 'تغییر غیرمجاز' })
      .expect(403);

    const memberships = await requestApp(app)
      .get('/api/v1/memberships')
      .set('Cookie', cookieTwo)
      .set('X-Company-Id', companyA)
      .expect(403);
    expect(memberships.body.error.code).toBe('PERMISSION_DENIED');
  });

  it('cuts access on the next request when a membership is deactivated', async () => {
    await requestApp(app)
      .get('/api/v1/company')
      .set('Cookie', cookieTwo)
      .set('X-Company-Id', companyA)
      .expect(200);

    await admin().query(
      `UPDATE company_memberships SET status = 'inactive'
        WHERE user_id = $1 AND company_id = $2`,
      [userTwo, companyA],
    );

    // Existing session stays valid for identity, but company access is gone.
    await requestApp(app).get('/api/v1/me').set('Cookie', cookieTwo).expect(200);
    const denied = await requestApp(app)
      .get('/api/v1/company')
      .set('Cookie', cookieTwo)
      .set('X-Company-Id', companyA)
      .expect(403);
    expect(denied.body.error.code).toBe('COMPANY_ACCESS_DENIED');
  });

  it('cuts access immediately when the user is deactivated', async () => {
    await admin().query(`UPDATE users SET status = 'inactive' WHERE id = $1`, [userTwo]);
    const response = await requestApp(app)
      .get('/api/v1/company')
      .set('Cookie', cookieTwo)
      .set('X-Company-Id', companyA)
      .expect(401);
    expect(response.body.error.code).toBe('AUTH_REQUIRED');
  });

  it('blocks a suspended company or entitlement without deleting data', async () => {
    await admin().query(`UPDATE company_entitlements SET status = 'suspended' WHERE company_id = $1`, [
      companyA,
    ]);
    const suspendedLicense = await requestApp(app)
      .get('/api/v1/company')
      .set('Cookie', cookieOne)
      .set('X-Company-Id', companyA)
      .expect(403);
    expect(suspendedLicense.body.error.code).toBe('LICENSE_INACTIVE');

    await admin().query(`UPDATE company_entitlements SET status = 'active'`);
    await admin().query(`UPDATE companies SET status = 'suspended' WHERE id = $1`, [companyA]);

    const suspendedCompany = await requestApp(app)
      .get('/api/v1/company')
      .set('Cookie', cookieOne)
      .set('X-Company-Id', companyA)
      .expect(403);
    expect(suspendedCompany.body.error.code).toBe('LICENSE_INACTIVE');

    const stillThere = await admin().query('SELECT 1 FROM companies WHERE id = $1', [companyA]);
    expect(stillThere.rowCount).toBe(1);
  });

  it('audits company updates with before and after values', async () => {
    await requestApp(app)
      .patch('/api/v1/company')
      .set('Cookie', cookieOne)
      .set('X-Company-Id', companyA)
      .send({ name: 'نام ممیزی‌شده' })
      .expect(200);

    const audit = await admin().query<{ details: { after: { name: string } }; actor_type: string }>(
      `SELECT details, actor_type FROM audit_events
        WHERE company_id = $1 AND action = 'company.updated'
        ORDER BY id DESC LIMIT 1`,
      [companyA],
    );
    expect(audit.rowCount).toBe(1);
    expect(audit.rows[0].actor_type).toBe('user');
    expect(audit.rows[0].details.after.name).toBe('نام ممیزی‌شده');
  });
});
