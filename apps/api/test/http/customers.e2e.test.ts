import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type {
  CreateCustomerInput,
  Customer,
  CustomerListQuery,
  PaginatedData,
  UpdateCustomerInput,
} from '@bazariya/shared';
import type { CustomersRepository as CustomersRepositoryContract } from '../../src/customers/customers.repository.js';
import { PG_POOL } from '../../src/database/database.constants.js';

process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://bazariya:bazariya_dev_only@localhost:5432/bazariya_test';

const [{ AppModule }, { configureApp }, { CustomersRepository }] = await Promise.all([
  import('../../src/app.module.js'),
  import('../../src/configure-app.js'),
  import('../../src/customers/customers.repository.js'),
]);

class MemoryCustomersRepository implements Pick<CustomersRepositoryContract, 'list' | 'findById' | 'create' | 'update' | 'delete'> {
  private readonly customers = new Map<string, Customer>();

  reset(): void {
    this.customers.clear();
  }

  all(): Customer[] {
    return [...this.customers.values()];
  }

  async list(query: CustomerListQuery): Promise<PaginatedData<Customer>> {
    const search = query.search?.trim().toLocaleLowerCase('en-US');
    const filtered = this.all()
      .filter((customer) => !search
        || customer.name.toLocaleLowerCase('en-US').includes(search)
        || customer.phone?.includes(search)
        || customer.email?.toLocaleLowerCase('en-US').includes(search))
      .filter((customer) => query.isActive === undefined || customer.isActive === query.isActive)
      .sort((left, right) => left.name.localeCompare(right.name, 'fa') || left.id.localeCompare(right.id));
    const total = filtered.length;
    const offset = (query.page - 1) * query.pageSize;
    return {
      items: filtered.slice(offset, offset + query.pageSize),
      pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
    };
  }

  async findById(id: string): Promise<Customer | null> {
    return this.customers.get(id) ?? null;
  }

  async create(input: CreateCustomerInput): Promise<Customer> {
    const now = new Date().toISOString();
    const customer: Customer = {
      id: randomUUID(),
      name: input.name,
      phone: input.phone ?? null,
      email: input.email ?? null,
      address: input.address ?? null,
      description: input.description ?? null,
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.customers.set(customer.id, customer);
    return customer;
  }

  async update(id: string, input: UpdateCustomerInput): Promise<Customer | null> {
    const current = this.customers.get(id);
    if (!current) return null;
    const updated: Customer = {
      ...current,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedAt: new Date().toISOString(),
    };
    this.customers.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.customers.delete(id);
  }
}

describe('Customers API', () => {
  let app: INestApplication;
  let customers: MemoryCustomersRepository;

  before(async () => {
    customers = new MemoryCustomersRepository();
    const pool = {
      query: async () => ({ rows: [], rowCount: 0 }),
      end: async () => undefined,
    };
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PG_POOL)
      .useValue(pool)
      .overrideProvider(CustomersRepository)
      .useValue(customers)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app, 'http://localhost:5173');
    await app.init();
  });

  after(async () => {
    await app.close();
  });

  beforeEach(() => customers.reset());

  async function createCustomer(input: Record<string, unknown> = {}): Promise<Customer> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .send({ name: 'مشتری آزمایشی', ...input })
      .expect(201);
    return response.body.data as Customer;
  }

  it('supports customer create, get, partial update, nullable clearing, and delete', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .send({
        name: '  سارا احمدی  ',
        phone: ' ۰۹۱۲ ۱۲۳ ۴۵۶۷ ',
        email: '  SARA.Example@Example.COM  ',
        address: '  خیابان نمونه  ',
        description: '  مشتری حضوری  ',
      })
      .expect(201);
    const customer = created.body.data as Customer;
    assert.equal(customer.name, 'سارا احمدی');
    assert.equal(customer.phone, '09121234567');
    assert.equal(customer.email, 'sara.example@example.com');
    assert.equal(customer.address, 'خیابان نمونه');
    assert.equal(customer.description, 'مشتری حضوری');
    assert.equal(customer.isActive, true);
    assert.ok(Number.isFinite(Date.parse(customer.createdAt)));
    assert.ok(Number.isFinite(Date.parse(customer.updatedAt)));

    const fetched = await request(app.getHttpServer()).get(`/api/v1/customers/${customer.id}`).expect(200);
    assert.equal(fetched.body.data.id, customer.id);

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/customers/${customer.id}`)
      .send({ name: '  سارا رضایی  ', isActive: false })
      .expect(200);
    assert.equal(updated.body.data.name, 'سارا رضایی');
    assert.equal(updated.body.data.phone, customer.phone);
    assert.equal(updated.body.data.isActive, false);

    const cleared = await request(app.getHttpServer())
      .patch(`/api/v1/customers/${customer.id}`)
      .send({ phone: null, email: null, address: null, description: null })
      .expect(200);
    assert.equal(cleared.body.data.phone, null);
    assert.equal(cleared.body.data.email, null);
    assert.equal(cleared.body.data.address, null);
    assert.equal(cleared.body.data.description, null);

    await request(app.getHttpServer()).delete(`/api/v1/customers/${customer.id}`).expect(200);
    await request(app.getHttpServer()).get(`/api/v1/customers/${customer.id}`).expect(404);
  });

  it('searches name, phone, and email, and filters and paginates by active status', async () => {
    const first = await createCustomer({ name: 'Alice Martin', phone: '09121234567', email: 'alice@example.com' });
    const second = await createCustomer({ name: 'Bob Martin', phone: '02112345678', email: 'bob@example.com' });
    await request(app.getHttpServer()).patch(`/api/v1/customers/${second.id}`).send({ isActive: false }).expect(200);

    for (const search of ['alice', '0912123', 'alice@example.com']) {
      const response = await request(app.getHttpServer())
        .get('/api/v1/customers')
        .query({ search })
        .expect(200);
      assert.deepEqual(response.body.data.items.map((item: Customer) => item.id), [first.id]);
    }

    const inactive = await request(app.getHttpServer())
      .get('/api/v1/customers')
      .query({ isActive: 'false', page: 1, pageSize: 1 })
      .expect(200);
    assert.deepEqual(inactive.body.data.items.map((item: Customer) => item.id), [second.id]);
    assert.deepEqual(inactive.body.data.pagination, { page: 1, pageSize: 1, total: 1, totalPages: 1 });

    const defaults = await request(app.getHttpServer()).get('/api/v1/customers').expect(200);
    assert.equal(defaults.body.data.pagination.page, 1);
    assert.equal(defaults.body.data.pagination.pageSize, 20);
    assert.equal(defaults.body.data.pagination.total, 2);
  });

  it('rejects empty patches, invalid contacts, unknown fields, and invalid pagination safely', async () => {
    const customer = await createCustomer();

    const emptyPatch = await request(app.getHttpServer())
      .patch(`/api/v1/customers/${customer.id}`)
      .send({})
      .expect(400);
    assert.equal(emptyPatch.body.error.code, 'CUSTOMER_INVALID');

    for (const body of [
      { name: '   ' },
      { phone: '12-34' },
      { phone: 12 },
      { email: 'not-an-email' },
    ]) {
      const response = await request(app.getHttpServer()).post('/api/v1/customers').send(body).expect(400);
      assert.ok(response.body.error.code);
      assert.equal(JSON.stringify(response.body).includes('private database details'), false);
    }

    const unknownField = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .send({ name: 'مشتری ناشناس', balance: 5_000 })
      .expect(400);
    assert.equal(unknownField.body.error.code, 'VALIDATION_ERROR');

    const tooLargePageSize = await request(app.getHttpServer()).get('/api/v1/customers?pageSize=101').expect(400);
    assert.equal(tooLargePageSize.body.error.code, 'VALIDATION_ERROR');
    const tooLargePage = await request(app.getHttpServer()).get('/api/v1/customers?page=2147483648').expect(400);
    assert.equal(tooLargePage.body.error.code, 'VALIDATION_ERROR');
    const badStatus = await request(app.getHttpServer()).get('/api/v1/customers?isActive=yes').expect(400);
    assert.equal(badStatus.body.error.code, 'VALIDATION_ERROR');
    const invalidId = await request(app.getHttpServer()).get('/api/v1/customers/not-a-uuid').expect(400);
    assert.equal(invalidId.body.error.code, 'VALIDATION_ERROR');

    const missing = await request(app.getHttpServer()).get(`/api/v1/customers/${randomUUID()}`).expect(404);
    assert.equal(missing.body.error.code, 'CUSTOMER_NOT_FOUND');
  });
});
