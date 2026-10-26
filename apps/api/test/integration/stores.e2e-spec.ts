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
  seedStore,
  seedUser,
  uniqueCode,
  uniqueMobile,
} from '../helpers/harness';

const PASSWORD = 'StorePass12345';

interface StoreBody {
  id: string;
  name: string;
  contactName: string | null;
  contactMobile: string | null;
  address: string | null;
  note: string | null;
  status: 'active' | 'inactive';
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

describe('Store management (PH-2)', () => {
  let app: INestApplication;
  let companyA: string;
  let companyB: string;
  let managerId: string;
  let managerCookie: string;
  let salesCookie: string;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await closeApp(app);
    await closeAdminPool();
  });

  beforeEach(async () => {
    await resetDatabase();

    const a = await seedCompany({ code: uniqueCode('STRA'), name: 'شرکت فروشگاه آ' });
    const b = await seedCompany({ code: uniqueCode('STRB'), name: 'شرکت فروشگاه ب' });
    companyA = a.companyId;
    companyB = b.companyId;

    const managerMobile = uniqueMobile();
    managerId = await seedUser({
      mobile: managerMobile,
      password: PASSWORD,
      fullName: 'مدیر فروشگاه‌ها',
    });
    await seedMembership({ userId: managerId, companyId: companyA, role: 'manager' });

    const salesMobile = uniqueMobile();
    const salesId = await seedUser({
      mobile: salesMobile,
      password: PASSWORD,
      fullName: 'کارشناس فروش',
    });
    await seedMembership({
      userId: salesId,
      companyId: companyA,
      role: 'sales_representative',
    });

    const otherManagerMobile = uniqueMobile();
    const otherManager = await seedUser({
      mobile: otherManagerMobile,
      password: PASSWORD,
      fullName: 'مدیر شرکت ب',
    });
    await seedMembership({
      userId: otherManager,
      companyId: companyB,
      role: 'manager',
    });

    managerCookie = (await login(app, managerMobile, PASSWORD)).cookie;
    salesCookie = (await login(app, salesMobile, PASSWORD)).cookie;
  });

  function createStore(body: Record<string, unknown> = {}) {
    return requestApp(app)
      .post('/api/v1/stores')
      .set('Cookie', managerCookie)
      .set('X-Company-Id', companyA)
      .send({ name: 'فروشگاه نمونه', ...body });
  }

  it('creates a store with normalized contact data and audits the operation', async () => {
    const response = await createStore({
      name: 'فروشگاه آبی',
      contactName: 'رضا محمدی',
      contactMobile: '0912 123 4567',
      address: 'تهران، خیابان نمونه',
      note: 'تحویل صبح‌ها',
    }).expect(201);

    const store = response.body.data as StoreBody;
    expect(store.name).toBe('فروشگاه آبی');
    expect(store.contactMobile).toBe('+989121234567');
    expect(store.status).toBe('active');
    expect(store.createdByUserId).toBe(managerId);
    expect(store.updatedByUserId).toBe(managerId);
    expect(store.createdAt).toBeTruthy();
    expect(JSON.stringify(response.body)).not.toContain(PASSWORD);

    const audit = await admin().query<{ details: { name: string }; actor_type: string }>(
      `SELECT details, actor_type FROM audit_events
        WHERE company_id = $1 AND action = 'store.created'
        ORDER BY id DESC LIMIT 1`,
      [companyA],
    );
    expect(audit.rowCount).toBe(1);
    expect(audit.rows[0].actor_type).toBe('user');
    expect(audit.rows[0].details.name).toBe('فروشگاه آبی');
  });

  it('lists only the active company stores and hides foreign store ids', async () => {
    const mine = await createStore({ name: 'فروشگاه من' }).expect(201);
    const foreign = await seedStore({
      companyId: companyB,
      name: 'فروشگاه شرکت دیگر',
    });

    const list = await requestApp(app)
      .get('/api/v1/stores')
      .set('Cookie', managerCookie)
      .set('X-Company-Id', companyA)
      .expect(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].id).toBe(mine.body.data.id as string);
    expect(JSON.stringify(list.body)).not.toContain('فروشگاه شرکت دیگر');

    const foreignGet = await requestApp(app)
      .get(`/api/v1/stores/${foreign}`)
      .set('Cookie', managerCookie)
      .set('X-Company-Id', companyA)
      .expect(404);
    expect(foreignGet.body.error.code).toBe('RESOURCE_NOT_FOUND');
    expect(JSON.stringify(foreignGet.body)).not.toContain('فروشگاه شرکت دیگر');

    const foreignPatch = await requestApp(app)
      .patch(`/api/v1/stores/${foreign}`)
      .set('Cookie', managerCookie)
      .set('X-Company-Id', companyA)
      .send({ name: 'تغییر غیرمجاز' })
      .expect(404);
    expect(foreignPatch.body.error.code).toBe('RESOURCE_NOT_FOUND');

    const foreignStatus = await requestApp(app)
      .patch(`/api/v1/stores/${foreign}/status`)
      .set('Cookie', managerCookie)
      .set('X-Company-Id', companyA)
      .send({ status: 'inactive' })
      .expect(404);
    expect(foreignStatus.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('rejects forged company headers and users without store permissions', async () => {
    const forged = await requestApp(app)
      .get('/api/v1/stores')
      .set('Cookie', managerCookie)
      .set('X-Company-Id', companyB)
      .expect(403);
    expect(forged.body.error.code).toBe('COMPANY_ACCESS_DENIED');

    const salesList = await requestApp(app)
      .get('/api/v1/stores')
      .set('Cookie', salesCookie)
      .set('X-Company-Id', companyA)
      .expect(403);
    expect(salesList.body.error.code).toBe('PERMISSION_DENIED');

    const salesCreate = await requestApp(app)
      .post('/api/v1/stores')
      .set('Cookie', salesCookie)
      .set('X-Company-Id', companyA)
      .send({ name: 'فروشگاه غیرمجاز' })
      .expect(403);
    expect(salesCreate.body.error.code).toBe('PERMISSION_DENIED');
  });

  it('validates query, body and identifier inputs instead of ignoring them', async () => {
    const invalidQueries = [
      'page=0',
      'pageSize=101',
      'page=abc',
      'sort=unknown',
      'status=deleted',
      'unknown=1',
    ];
    for (const query of invalidQueries) {
      const response = await requestApp(app)
        .get(`/api/v1/stores?${query}`)
        .set('Cookie', managerCookie)
        .set('X-Company-Id', companyA)
        .expect(422);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }

    await createStore({ name: 'a' }).expect(422);
    await createStore({ contactMobile: '12345' }).expect(422);
    await createStore({ unknownField: 'x' }).expect(422);

    const created = await createStore({ name: 'فروشگاه معتبر' }).expect(201);
    await requestApp(app)
      .patch(`/api/v1/stores/${created.body.data.id}`)
      .set('Cookie', managerCookie)
      .set('X-Company-Id', companyA)
      .send({})
      .expect(422);

    await requestApp(app)
      .get('/api/v1/stores/not-a-uuid')
      .set('Cookie', managerCookie)
      .set('X-Company-Id', companyA)
      .expect(404);

    await requestApp(app)
      .delete(`/api/v1/stores/${created.body.data.id}`)
      .set('Cookie', managerCookie)
      .set('X-Company-Id', companyA)
      .expect(404);
  });

  it('supports search, status filter, whitelisted sorting and server pagination', async () => {
    await createStore({
      name: 'فروشگاه آبی',
      contactMobile: '09121234567',
      address: 'تهران',
    }).expect(201);
    await createStore({ name: 'فروشگاه سبز', address: 'کرج' }).expect(201);
    const inactive = await createStore({ name: 'فروشگاه قرمز' }).expect(201);
    await requestApp(app)
      .patch(`/api/v1/stores/${inactive.body.data.id}/status`)
      .set('Cookie', managerCookie)
      .set('X-Company-Id', companyA)
      .send({ status: 'inactive' })
      .expect(200);

    const byName = await requestApp(app)
      .get('/api/v1/stores?q=%D8%A2%D8%A8%DB%8C')
      .set('Cookie', managerCookie)
      .set('X-Company-Id', companyA)
      .expect(200);
    expect(byName.body.data).toHaveLength(1);
    expect(byName.body.data[0].name).toBe('فروشگاه آبی');

    const byNormalizedMobile = await requestApp(app)
      .get('/api/v1/stores?q=09121234567')
      .set('Cookie', managerCookie)
      .set('X-Company-Id', companyA)
      .expect(200);
    expect(byNormalizedMobile.body.data).toHaveLength(1);
    expect(byNormalizedMobile.body.data[0].name).toBe('فروشگاه آبی');

    const inactiveOnly = await requestApp(app)
      .get('/api/v1/stores?status=inactive')
      .set('Cookie', managerCookie)
      .set('X-Company-Id', companyA)
      .expect(200);
    expect(inactiveOnly.body.data).toHaveLength(1);
    expect(inactiveOnly.body.data[0].status).toBe('inactive');

    const pageTwo = await requestApp(app)
      .get('/api/v1/stores?pageSize=2&page=2&sort=name')
      .set('Cookie', managerCookie)
      .set('X-Company-Id', companyA)
      .expect(200);
    expect(pageTwo.body.data).toHaveLength(1);
    expect(pageTwo.body.meta).toMatchObject({
      page: 2,
      pageSize: 2,
      totalItems: 3,
      totalPages: 2,
    });

    const descending = await requestApp(app)
      .get('/api/v1/stores?sort=-name')
      .set('Cookie', managerCookie)
      .set('X-Company-Id', companyA)
      .expect(200);
    expect(descending.body.meta.totalItems).toBe(3);
    expect(descending.body.data).toHaveLength(3);

    const ascending = await requestApp(app)
      .get('/api/v1/stores?sort=name')
      .set('Cookie', managerCookie)
      .set('X-Company-Id', companyA)
      .expect(200);
    expect(ascending.body.data.map((row: StoreBody) => row.name)).toEqual(
      descending.body.data.map((row: StoreBody) => row.name).reverse(),
    );

    // LIKE wildcards in the search term are escaped, not interpreted.
    const wildcard = await requestApp(app)
      .get('/api/v1/stores?q=%25')
      .set('Cookie', managerCookie)
      .set('X-Company-Id', companyA)
      .expect(200);
    expect(wildcard.body.meta.totalItems).toBe(0);
  });

  it('enforces the licensed store cap without ever deleting data', async () => {
    const limited = await seedCompany({ code: uniqueCode('CAP'), maxStores: 2 });
    const mobile = uniqueMobile();
    const userId = await seedUser({
      mobile,
      password: PASSWORD,
      fullName: 'مدیر سقف مجوز',
    });
    await seedMembership({ userId, companyId: limited.companyId, role: 'manager' });
    const cookie = (await login(app, mobile, PASSWORD)).cookie;

    const create = (name: string) =>
      requestApp(app)
        .post('/api/v1/stores')
        .set('Cookie', cookie)
        .set('X-Company-Id', limited.companyId)
        .send({ name });

    const first = await create('فروشگاه یک').expect(201);
    await create('فروشگاه دو').expect(201);

    const blocked = await create('فروشگاه سه').expect(403);
    expect(blocked.body.error.code).toBe('LICENSE_STORE_LIMIT_REACHED');
    expect(blocked.body.error.message).toMatch(/[\u0600-\u06FF]/);
    expect(blocked.body.error.meta).toMatchObject({ limit: 2, active: 2 });

    const company = await requestApp(app)
      .get('/api/v1/company')
      .set('Cookie', cookie)
      .set('X-Company-Id', limited.companyId)
      .expect(200);
    expect(company.body.data.storeUsage).toEqual({ active: 2, limit: 2 });

    const emptyPage = await requestApp(app)
      .get('/api/v1/stores?status=inactive')
      .set('Cookie', cookie)
      .set('X-Company-Id', limited.companyId)
      .expect(200);
    expect(emptyPage.body.meta.totalItems).toBe(0);

    // Deactivating a store frees capacity for a new one.
    await requestApp(app)
      .patch(`/api/v1/stores/${first.body.data.id}/status`)
      .set('Cookie', cookie)
      .set('X-Company-Id', limited.companyId)
      .send({ status: 'inactive' })
      .expect(200);
    await create('فروشگاه سه').expect(201);

    // Reactivating the old store would exceed the cap again.
    const reactivation = await requestApp(app)
      .patch(`/api/v1/stores/${first.body.data.id}/status`)
      .set('Cookie', cookie)
      .set('X-Company-Id', limited.companyId)
      .send({ status: 'active' })
      .expect(403);
    expect(reactivation.body.error.code).toBe('LICENSE_STORE_LIMIT_REACHED');

    const stored = await admin().query<{ count: string }>(
      'SELECT count(*) FROM stores WHERE company_id = $1',
      [limited.companyId],
    );
    expect(Number(stored.rows[0].count)).toBe(3);
  });

  it('updates fields and status with before/after audit entries', async () => {
    const created = await createStore({
      name: 'فروشگاه قابل ویرایش',
      contactName: 'علی',
      address: 'تهران',
    }).expect(201);

    const updated = await requestApp(app)
      .patch(`/api/v1/stores/${created.body.data.id}`)
      .set('Cookie', managerCookie)
      .set('X-Company-Id', companyA)
      .send({ name: 'فروشگاه ویرایش‌شده', contactMobile: '۰۹۱۲۹۸۷۶۵۴۳', note: null })
      .expect(200);
    expect(updated.body.data.name).toBe('فروشگاه ویرایش‌شده');
    expect(updated.body.data.contactMobile).toBe('+989129876543');
    expect(updated.body.data.note).toBeNull();
    expect(updated.body.data.updatedByUserId).toBe(managerId);

    const updateAudit = await admin().query<{ details: { before: { name: string }; after: { name: string } } }>(
      `SELECT details FROM audit_events
        WHERE company_id = $1 AND action = 'store.updated'
        ORDER BY id DESC LIMIT 1`,
      [companyA],
    );
    expect(updateAudit.rows[0].details.before.name).toBe('فروشگاه قابل ویرایش');
    expect(updateAudit.rows[0].details.after.name).toBe('فروشگاه ویرایش‌شده');

    const deactivated = await requestApp(app)
      .patch(`/api/v1/stores/${created.body.data.id}/status`)
      .set('Cookie', managerCookie)
      .set('X-Company-Id', companyA)
      .send({ status: 'inactive' })
      .expect(200);
    expect(deactivated.body.data.status).toBe('inactive');

    const statusAudit = await admin().query<{ details: { before: { status: string }; after: { status: string } } }>(
      `SELECT details FROM audit_events
        WHERE company_id = $1 AND action = 'store.status_changed'
        ORDER BY id DESC LIMIT 1`,
      [companyA],
    );
    expect(statusAudit.rows[0].details.before.status).toBe('active');
    expect(statusAudit.rows[0].details.after.status).toBe('inactive');
  });
});
