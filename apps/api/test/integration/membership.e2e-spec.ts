import { createHash } from 'node:crypto';
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

const MANAGER_PASSWORD = 'ManagerPass12345';

describe('Company membership management (PH-1)', () => {
  let app: INestApplication;
  let companyId: string;
  let managerId: string;
  let managerCookie: string;
  let managerMobile: string;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await closeApp(app);
    await closeAdminPool();
  });

  beforeEach(async () => {
    await resetDatabase();
    const company = await seedCompany({ code: uniqueCode('MEM'), name: 'شرکت عضویت' });
    companyId = company.companyId;

    managerMobile = uniqueMobile();
    managerId = await seedUser({
      mobile: managerMobile,
      password: MANAGER_PASSWORD,
      fullName: 'مدیر شرکت',
    });
    await seedMembership({ userId: managerId, companyId, role: 'manager' });

    const salesId = await seedUser({
      mobile: uniqueMobile(),
      password: MANAGER_PASSWORD,
      fullName: 'کارشناس فروش',
    });
    await seedMembership({ userId: salesId, companyId, role: 'sales_representative' });

    const session = await login(app, managerMobile, MANAGER_PASSWORD);
    managerCookie = session.cookie;
  });

  async function membershipId(userId: string): Promise<string> {
    const result = await admin().query<{ id: string }>(
      'SELECT id FROM company_memberships WHERE user_id = $1 AND company_id = $2',
      [userId, companyId],
    );
    return result.rows[0].id;
  }

  it('lists company memberships for a manager', async () => {
    const response = await requestApp(app)
      .get('/api/v1/memberships')
      .set('Cookie', managerCookie)
      .set('X-Company-Id', companyId)
      .expect(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data.map((row: { role: string }) => row.role).sort()).toEqual([
      'manager',
      'sales_representative',
    ]);
  });

  it('adds a new user and returns a one-time activation token', async () => {
    const mobile = uniqueMobile();
    const response = await requestApp(app)
      .post('/api/v1/memberships')
      .set('Cookie', managerCookie)
      .set('X-Company-Id', companyId)
      .send({ mobile, fullName: 'کاربر جدید', role: 'warehouse_user' })
      .expect(201);

    expect(response.body.data.membership.mobile).toBe(mobile);
    expect(response.body.data.membership.status).toBe('active');
    expect(typeof response.body.data.inviteToken).toBe('string');
    expect(response.body.data.inviteToken.length).toBeGreaterThan(20);
    expect(JSON.stringify(response.body)).not.toContain('password');

    const user = await admin().query<{ password_hash: string | null }>(
      'SELECT password_hash FROM users WHERE mobile = $1',
      [mobile],
    );
    expect(user.rows[0].password_hash).toBeNull();

    const audit = await admin().query<{ details: unknown }>(
      `SELECT details FROM audit_events
        WHERE company_id = $1 AND action = 'membership.created'`,
      [companyId],
    );
    expect(audit.rowCount).toBe(1);
    expect(JSON.stringify(audit.rows[0].details)).not.toContain(
      response.body.data.inviteToken,
    );
  });

  it('does not create a duplicate membership for the same company', async () => {
    const existing = await admin().query<{ mobile: string }>(
      `SELECT u.mobile FROM users u
        JOIN company_memberships m ON m.user_id = u.id
       WHERE m.company_id = $1 AND m.role_code = 'sales_representative'`,
      [companyId],
    );

    const response = await requestApp(app)
      .post('/api/v1/memberships')
      .set('Cookie', managerCookie)
      .set('X-Company-Id', companyId)
      .send({
        mobile: existing.rows[0].mobile,
        fullName: 'کاربر تکراری',
        role: 'manager',
      })
      .expect(409);
    expect(response.body.error.code).toBe('MEMBERSHIP_EXISTS');
  });

  it('lets an invited user activate the account and then applies their role', async () => {
    const mobile = uniqueMobile();
    const added = await requestApp(app)
      .post('/api/v1/memberships')
      .set('Cookie', managerCookie)
      .set('X-Company-Id', companyId)
      .send({ mobile, fullName: 'فروشنده تازه', role: 'sales_representative' })
      .expect(201);

    const inviteToken = added.body.data.inviteToken as string;
    const membershipId = added.body.data.membership.id as string;
    const password = 'InvitedUser12345';

    await requestApp(app)
      .post('/api/v1/auth/password/set')
      .send({ token: inviteToken, newPassword: password })
      .expect(200);

    const invited = await login(app, mobile, password);

    const company = await requestApp(app)
      .get('/api/v1/company')
      .set('Cookie', invited.cookie)
      .set('X-Company-Id', companyId)
      .expect(200);
    expect(company.body.data.role).toBe('sales_representative');

    await requestApp(app)
      .post('/api/v1/memberships')
      .set('Cookie', invited.cookie)
      .set('X-Company-Id', companyId)
      .send({ mobile: uniqueMobile(), fullName: 'کاربر دیگر', role: 'warehouse_user' })
      .expect(403);

    // Role change is read per request: the same session gains the permission.
    await requestApp(app)
      .patch(`/api/v1/memberships/${membershipId}`)
      .set('Cookie', managerCookie)
      .set('X-Company-Id', companyId)
      .send({ role: 'manager' })
      .expect(200);

    await requestApp(app)
      .patch('/api/v1/company')
      .set('Cookie', invited.cookie)
      .set('X-Company-Id', companyId)
      .send({ name: 'شرکت با مدیر جدید' })
      .expect(200);
  });

  it('forbids changing your own role or membership status', async () => {
    const ownMembership = await membershipId(managerId);
    const response = await requestApp(app)
      .patch(`/api/v1/memberships/${ownMembership}`)
      .set('Cookie', managerCookie)
      .set('X-Company-Id', companyId)
      .send({ role: 'sales_representative' })
      .expect(403);
    expect(response.body.error.code).toBe('SELF_MANAGEMENT_FORBIDDEN');
  });

  it('deactivates a membership immediately and keeps audit history', async () => {
    const target = await admin().query<{ id: string; mobile: string }>(
      `SELECT u.id, u.mobile FROM users u
        JOIN company_memberships m ON m.user_id = u.id
       WHERE m.company_id = $1 AND m.role_code = 'sales_representative'`,
      [companyId],
    );
    const targetId = target.rows[0].id;
    const targetMobile = target.rows[0].mobile;
    const targetCookie = (await login(app, targetMobile, MANAGER_PASSWORD)).cookie;
    const targetMembership = await membershipId(targetId);

    await requestApp(app)
      .patch(`/api/v1/memberships/${targetMembership}`)
      .set('Cookie', managerCookie)
      .set('X-Company-Id', companyId)
      .send({ status: 'inactive' })
      .expect(200);

    const denied = await requestApp(app)
      .get('/api/v1/company')
      .set('Cookie', targetCookie)
      .set('X-Company-Id', companyId)
      .expect(403);
    expect(denied.body.error.code).toBe('COMPANY_ACCESS_DENIED');

    const audit = await admin().query(
      `SELECT 1 FROM audit_events
        WHERE company_id = $1 AND action = 'membership.updated'`,
      [companyId],
    );
    expect(audit.rowCount).toBe(1);
  });

  it('issues a reset token and revokes the previous session when the password is replaced', async () => {
    const target = await admin().query<{ id: string; mobile: string }>(
      `SELECT u.id, u.mobile FROM users u
        JOIN company_memberships m ON m.user_id = u.id
       WHERE m.company_id = $1 AND m.role_code = 'sales_representative'`,
      [companyId],
    );
    const targetMembership = await membershipId(target.rows[0].id);
    const oldCookie = (await login(app, target.rows[0].mobile, MANAGER_PASSWORD)).cookie;

    const reset = await requestApp(app)
      .post(`/api/v1/memberships/${targetMembership}/password-reset`)
      .set('Cookie', managerCookie)
      .set('X-Company-Id', companyId)
      .expect(200);

    const token = reset.body.data.token as string;
    const stored = await admin().query<{ token_hash: string; created_by_type: string }>(
      'SELECT token_hash, created_by_type FROM password_reset_tokens WHERE user_id = $1',
      [target.rows[0].id],
    );
    expect(stored.rows[0].token_hash).toBe(
      createHash('sha256').update(token).digest('hex'),
    );
    expect(stored.rows[0].created_by_type).toBe('user');

    await requestApp(app)
      .post('/api/v1/auth/password/set')
      .send({ token, newPassword: 'ReplacedPass12345' })
      .expect(200);

    await requestApp(app).get('/api/v1/me').set('Cookie', oldCookie).expect(401);
    await requestApp(app)
      .post('/api/v1/auth/login')
      .send({ mobile: target.rows[0].mobile, password: 'ReplacedPass12345' })
      .expect(200);
  });

  it('rejects invalid roles and invalid mobile numbers', async () => {
    await requestApp(app)
      .post('/api/v1/memberships')
      .set('Cookie', managerCookie)
      .set('X-Company-Id', companyId)
      .send({ mobile: uniqueMobile(), fullName: 'کاربر', role: 'platform_admin' })
      .expect(422);

    const invalidMobile = await requestApp(app)
      .post('/api/v1/memberships')
      .set('Cookie', managerCookie)
      .set('X-Company-Id', companyId)
      .send({ mobile: '12345', fullName: 'کاربر', role: 'manager' })
      .expect(422);
    expect(invalidMobile.body.error.code).toBe('VALIDATION_ERROR');
  });
});
