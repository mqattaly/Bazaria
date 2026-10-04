import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type {
  CreateOrderInput,
  OrderCustomerSummary,
  OrderDetails,
  OrderItem,
  OrderListItem,
  OrderListQuery,
  PaginatedData,
  ProductUnit,
  UpdateOrderInput,
} from '@bazariya/shared';
import type { OrdersRepository as OrdersRepositoryContract } from '../../src/orders/orders.repository.js';
import { OrderDomainError } from '../../src/orders/orders.errors.js';
import { calculateOrderTotals, mergeDuplicateItems } from '../../src/orders/orders.calculations.js';
import { PG_POOL } from '../../src/database/database.constants.js';

process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://bazariya:bazariya_dev_only@localhost:5432/bazariya_test';

const [{ AppModule }, { configureApp }, { OrdersRepository }] = await Promise.all([
  import('../../src/app.module.js'),
  import('../../src/configure-app.js'),
  import('../../src/orders/orders.repository.js'),
]);

interface TestProduct {
  id: string;
  name: string;
  sku: string;
  unit: ProductUnit;
  salePrice: number;
  isActive: boolean;
}

interface TestCustomer extends OrderCustomerSummary {
  isActive: boolean;
}

class MemoryOrdersRepository implements Pick<OrdersRepositoryContract, 'list' | 'findById' | 'create' | 'update' | 'updateStatus'> {
  private readonly orders = new Map<string, OrderDetails>();
  private readonly products = new Map<string, TestProduct>();
  private readonly customers = new Map<string, TestCustomer>();
  private sequence = 0;

  reset(): void {
    this.orders.clear();
    this.products.clear();
    this.customers.clear();
    this.sequence = 0;
  }

  addProduct(product: TestProduct): void {
    this.products.set(product.id, product);
  }

  addCustomer(customer: TestCustomer): void {
    this.customers.set(customer.id, customer);
  }

  async list(query: OrderListQuery): Promise<PaginatedData<OrderListItem>> {
    const search = query.search?.toLocaleLowerCase('en-US');
    const filtered = [...this.orders.values()]
      .filter((order) => !query.status || order.status === query.status)
      .filter((order) => !query.customerId || order.customerId === query.customerId)
      .filter((order) => !query.from || Date.parse(order.createdAt) >= Date.parse(query.from))
      .filter((order) => !query.to || Date.parse(order.createdAt) <= Date.parse(query.to))
      .filter((order) => !search
        || order.orderNumber.toLocaleLowerCase('en-US').includes(search)
        || order.customer?.name.toLocaleLowerCase('en-US').includes(search)
        || order.items.some((item) => item.productName.toLocaleLowerCase('en-US').includes(search)
          || item.sku.toLocaleLowerCase('en-US').includes(search)))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    const total = filtered.length;
    const offset = (query.page - 1) * query.pageSize;
    const items = filtered.slice(offset, offset + query.pageSize).map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      status: order.status,
      note: order.note,
      subtotal: order.subtotal,
      discount: order.discount,
      total: order.total,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      confirmedAt: order.confirmedAt,
      cancelledAt: order.cancelledAt,
      customerName: order.customer?.name ?? null,
      customerPhone: order.customer?.phone ?? null,
      itemCount: order.items.length,
    }));
    return {
      items,
      pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
    };
  }

  async findById(id: string): Promise<OrderDetails | null> {
    return this.orders.get(id) ?? null;
  }

  async create(input: CreateOrderInput): Promise<OrderDetails> {
    const items = this.buildItems(input.items);
    const customer = input.customerId ? this.requireCustomer(input.customerId) : null;
    const totals = calculateOrderTotals(
      items.map((item) => ({ quantity: item.quantity, unitPrice: item.unitPrice })),
      input.discount ?? 0,
    );
    this.sequence += 1;
    const now = new Date().toISOString();
    const order: OrderDetails = {
      id: randomUUID(),
      orderNumber: `BAZ-${String(this.sequence).padStart(9, '0')}`,
      customerId: customer?.id ?? null,
      status: 'draft',
      note: input.note ?? null,
      subtotal: totals.subtotal,
      discount: totals.discount,
      total: totals.total,
      createdAt: now,
      updatedAt: now,
      confirmedAt: null,
      cancelledAt: null,
      customer: customer ? { id: customer.id, name: customer.name, phone: customer.phone } : null,
      items: items.map((item, index) => ({ ...item, total: totals.itemTotals[index]! })),
    };
    this.orders.set(order.id, order);
    return order;
  }

  async update(id: string, input: UpdateOrderInput): Promise<OrderDetails | null> {
    const current = this.orders.get(id);
    if (!current) return null;
    if (current.status !== 'draft') {
      throw new OrderDomainError('ORDER_NOT_EDITABLE', 'فقط سفارش پیش‌نویس قابل ویرایش است.', 409);
    }

    const customer = input.customerId === undefined
      ? current.customer
      : input.customerId === null ? null : this.requireCustomer(input.customerId);
    const items = input.items === undefined
      ? current.items
      : this.buildItems(input.items).map((item) => ({ ...item, total: item.unitPrice * item.quantity, id: randomUUID(), orderId: id }));
    const totals = calculateOrderTotals(
      items.map((item) => ({ quantity: item.quantity, unitPrice: item.unitPrice })),
      input.discount ?? current.discount,
    );
    const updated: OrderDetails = {
      ...current,
      customerId: customer?.id ?? null,
      customer: customer ? { id: customer.id, name: customer.name, phone: customer.phone } : null,
      note: input.note === undefined ? current.note : input.note,
      subtotal: totals.subtotal,
      discount: totals.discount,
      total: totals.total,
      updatedAt: new Date().toISOString(),
      items: items.map((item, index) => ({ ...item, total: totals.itemTotals[index]! })),
    };
    this.orders.set(id, updated);
    return updated;
  }

  async updateStatus(id: string, status: 'confirmed' | 'cancelled'): Promise<OrderDetails | null> {
    const current = this.orders.get(id);
    if (!current) return null;
    if (current.status === status) return current;
    const allowed = (current.status === 'draft' && (status === 'confirmed' || status === 'cancelled'))
      || (current.status === 'confirmed' && status === 'cancelled');
    if (!allowed) throw new OrderDomainError('ORDER_INVALID_STATUS_TRANSITION', 'تغییر وضعیت این سفارش مجاز نیست.', 409);
    const now = new Date().toISOString();
    const updated: OrderDetails = {
      ...current,
      status,
      updatedAt: now,
      confirmedAt: status === 'confirmed' ? now : current.confirmedAt,
      cancelledAt: status === 'cancelled' ? now : null,
    };
    this.orders.set(id, updated);
    return updated;
  }

  private buildItems(inputItems: CreateOrderInput['items']): OrderItem[] {
    const merged = mergeDuplicateItems(inputItems);
    const products = merged.map((item) => {
      const product = this.products.get(item.productId);
      if (!product) throw new OrderDomainError('PRODUCT_NOT_FOUND', 'یکی از محصولات سفارش پیدا نشد.', 404);
      if (!product.isActive) throw new OrderDomainError('PRODUCT_NOT_AVAILABLE', 'یکی از محصولات سفارش غیرفعال است.', 400);
      return { product, quantity: item.quantity };
    });
    const totals = calculateOrderTotals(
      products.map(({ product, quantity }) => ({ quantity, unitPrice: product.salePrice })),
      0,
    );
    return products.map(({ product, quantity }, index) => ({
      id: randomUUID(),
      orderId: '',
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      unit: product.unit,
      quantity,
      unitPrice: product.salePrice,
      total: totals.itemTotals[index]!,
    }));
  }

  private requireCustomer(id: string): TestCustomer {
    const customer = this.customers.get(id);
    if (!customer) throw new OrderDomainError('CUSTOMER_NOT_FOUND', 'مشتری انتخاب‌شده پیدا نشد.', 404);
    if (!customer.isActive) throw new OrderDomainError('CUSTOMER_NOT_AVAILABLE', 'مشتری انتخاب‌شده غیرفعال است.', 400);
    return customer;
  }
}

function makeProduct(overrides: Partial<TestProduct> = {}): TestProduct {
  return {
    id: randomUUID(),
    name: 'چای ممتاز',
    sku: 'TEA-001',
    unit: 'pack',
    salePrice: 125_000,
    isActive: true,
    ...overrides,
  };
}

describe('Order calculations', () => {
  it('merges repeated product rows and calculates integer line totals and order totals', () => {
    const productId = randomUUID();
    const items = mergeDuplicateItems([
      { productId, quantity: 2 },
      { productId, quantity: 3 },
    ]);
    assert.deepEqual(items, [{ productId, quantity: 5 }]);
    assert.deepEqual(calculateOrderTotals([{ quantity: 5, unitPrice: 125_000 }], 25_000), {
      subtotal: 625_000,
      discount: 25_000,
      total: 600_000,
      itemTotals: [625_000],
    });
  });

  it('rejects quantities, discounts, and products whose integer total exceeds the safe range', () => {
    assert.throws(() => calculateOrderTotals([{ quantity: 0, unitPrice: 1 }], 0), /تعداد/);
    assert.throws(() => calculateOrderTotals([{ quantity: 1, unitPrice: 20 }], 21), /تخفیف/);
    assert.throws(
      () => calculateOrderTotals([{ quantity: 2_147_483_647, unitPrice: Number.MAX_SAFE_INTEGER }], 0),
      /محدودهٔ مجاز/,
    );
    assert.throws(() => mergeDuplicateItems([
      { productId: 'same', quantity: 2_147_483_647 },
      { productId: 'same', quantity: 1 },
    ]), /حد مجاز/);
  });
});

describe('Orders API', () => {
  let app: INestApplication;
  let orders: MemoryOrdersRepository;

  before(async () => {
    orders = new MemoryOrdersRepository();
    const pool = {
      query: async () => ({ rows: [], rowCount: 0 }),
      connect: async () => { throw new Error('Orders API test must not connect to a database.'); },
      end: async () => undefined,
    };
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PG_POOL)
      .useValue(pool)
      .overrideProvider(OrdersRepository)
      .useValue(orders)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app, 'http://localhost:5173');
    await app.init();
  });

  after(async () => {
    await app.close();
  });

  beforeEach(() => orders.reset());

  it('creates orders from server-side product prices, snapshots fields, and supports optional customers', async () => {
    const product = makeProduct();
    orders.addProduct(product);
    const customer = { id: randomUUID(), name: 'مینا احمدی', phone: '09121234567', isActive: true };
    orders.addCustomer(customer);

    const response = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .send({
        customerId: customer.id,
        items: [
          { productId: product.id, quantity: 1 },
          { productId: product.id, quantity: 2 },
        ],
        discount: 25_000,
        note: '  سفارش تلفنی  ',
      })
      .expect(201);

    const order = response.body.data as OrderDetails;
    assert.match(order.orderNumber, /^BAZ-\d{9}$/);
    assert.equal(order.status, 'draft');
    assert.equal(order.customer?.id, customer.id);
    assert.equal(order.note, 'سفارش تلفنی');
    assert.equal(order.subtotal, 375_000);
    assert.equal(order.discount, 25_000);
    assert.equal(order.total, 350_000);
    assert.equal(order.items.length, 1);
    assert.deepEqual(
      { productName: order.items[0]?.productName, sku: order.items[0]?.sku, unit: order.items[0]?.unit, unitPrice: order.items[0]?.unitPrice, quantity: order.items[0]?.quantity },
      { productName: 'چای ممتاز', sku: 'TEA-001', unit: 'pack', unitPrice: 125_000, quantity: 3 },
    );
    assert.equal(Number.isFinite(Date.parse(order.createdAt)), true);
    assert.equal(new Date(order.createdAt).toISOString(), order.createdAt);

    const optionalCustomer = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .send({ items: [{ productId: product.id, quantity: 1 }] })
      .expect(201);
    assert.equal(optionalCustomer.body.data.customerId, null);
    assert.equal(optionalCustomer.body.data.total, product.salePrice);
  });

  it('validates unknown input, invalid item quantities, inactive references, and discounts', async () => {
    const product = makeProduct();
    orders.addProduct(product);

    for (const body of [
      { items: [{ productId: product.id, quantity: 1, unitPrice: 1 }] },
      { items: [{ productId: product.id, quantity: 1 }], total: 1 },
      { items: [{ productId: product.id, quantity: 0 }] },
      { items: [{ productId: 'not-a-uuid', quantity: 1 }] },
      { items: [] },
      { items: [{ productId: product.id, quantity: 1 }], discount: 1.5 },
      { items: [{ productId: product.id, quantity: 1 }], discount: null },
      { items: [{ productId: product.id, quantity: 1 }], status: 'draft' },
    ]) {
      const response = await request(app.getHttpServer()).post('/api/v1/orders').send(body).expect(400);
      assert.ok(response.body.error.code);
    }

    const inactiveProduct = makeProduct({ isActive: false });
    orders.addProduct(inactiveProduct);
    const unavailableProduct = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .send({ items: [{ productId: inactiveProduct.id, quantity: 1 }] })
      .expect(400);
    assert.equal(unavailableProduct.body.error.code, 'PRODUCT_NOT_AVAILABLE');

    const inactiveCustomer = { id: randomUUID(), name: 'مشتری غیرفعال', phone: null, isActive: false };
    orders.addCustomer(inactiveCustomer);
    const unavailableCustomer = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .send({ customerId: inactiveCustomer.id, items: [{ productId: product.id, quantity: 1 }] })
      .expect(400);
    assert.equal(unavailableCustomer.body.error.code, 'CUSTOMER_NOT_AVAILABLE');

    const missingProduct = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .send({ items: [{ productId: randomUUID(), quantity: 1 }] })
      .expect(404);
    assert.equal(missingProduct.body.error.code, 'PRODUCT_NOT_FOUND');

    const missingCustomer = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .send({ customerId: randomUUID(), items: [{ productId: product.id, quantity: 1 }] })
      .expect(404);
    assert.equal(missingCustomer.body.error.code, 'CUSTOMER_NOT_FOUND');

    const tooMuchDiscount = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .send({ items: [{ productId: product.id, quantity: 1 }], discount: product.salePrice + 1 })
      .expect(400);
    assert.equal(tooMuchDiscount.body.error.code, 'ORDER_DISCOUNT_INVALID');
  });

  it('lists with status, customer and explicit-timezone date filters, and phase pagination', async () => {
    const product = makeProduct();
    const customer = { id: randomUUID(), name: 'علی فروشنده', phone: null, isActive: true };
    orders.addProduct(product);
    orders.addCustomer(customer);
    const created = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .send({ customerId: customer.id, items: [{ productId: product.id, quantity: 1 }] })
      .expect(201);
    const order = created.body.data as OrderDetails;

    const filtered = await request(app.getHttpServer())
      .get('/api/v1/orders')
      .query({
        search: 'چای',
        customerId: customer.id,
        status: 'draft',
        from: '2026-01-01T00:00:00+03:30',
        to: '2027-01-01T00:00:00+03:30',
        page: 1,
        pageSize: 1,
      })
      .expect(200);
    assert.deepEqual(filtered.body.data.items.map((item: OrderListItem) => item.id), [order.id]);
    assert.deepEqual(filtered.body.data.pagination, { page: 1, pageSize: 1, total: 1, totalPages: 1 });

    const noTimezone = await request(app.getHttpServer())
      .get('/api/v1/orders?from=2026-01-01T00:00:00')
      .expect(400);
    assert.equal(noTimezone.body.error.code, 'VALIDATION_ERROR');

    const reversed = await request(app.getHttpServer())
      .get('/api/v1/orders')
      .query({ from: '2027-01-01T00:00:00Z', to: '2026-01-01T00:00:00Z' })
      .expect(400);
    assert.equal(reversed.body.error.code, 'ORDER_DATE_RANGE_INVALID');
  });

  it('edits drafts, confirms them, keeps confirmed contents immutable, and cancels without deletion', async () => {
    const product = makeProduct();
    const customer = { id: randomUUID(), name: 'نرگس محمدی', phone: null, isActive: true };
    orders.addProduct(product);
    orders.addCustomer(customer);
    const created = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .send({ items: [{ productId: product.id, quantity: 1 }] })
      .expect(201);
    const id = (created.body.data as OrderDetails).id;

    const invalidStatus = await request(app.getHttpServer())
      .patch(`/api/v1/orders/${id}/status`)
      .send({ status: 'draft' })
      .expect(400);
    assert.equal(invalidStatus.body.error.code, 'VALIDATION_ERROR');

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/orders/${id}`)
      .send({ customerId: customer.id, items: [{ productId: product.id, quantity: 2 }], discount: 5_000 })
      .expect(200);
    assert.equal(updated.body.data.subtotal, product.salePrice * 2);
    assert.equal(updated.body.data.total, product.salePrice * 2 - 5_000);

    const confirmed = await request(app.getHttpServer())
      .patch(`/api/v1/orders/${id}/status`)
      .send({ status: 'confirmed' })
      .expect(200);
    assert.equal(confirmed.body.data.status, 'confirmed');
    assert.ok(confirmed.body.data.confirmedAt);

    const immutable = await request(app.getHttpServer())
      .patch(`/api/v1/orders/${id}`)
      .send({ note: 'ویرایش مجاز نیست' })
      .expect(409);
    assert.equal(immutable.body.error.code, 'ORDER_NOT_EDITABLE');

    const cancelled = await request(app.getHttpServer())
      .patch(`/api/v1/orders/${id}/status`)
      .send({ status: 'cancelled' })
      .expect(200);
    assert.equal(cancelled.body.data.status, 'cancelled');
    assert.ok(cancelled.body.data.cancelledAt);

    const cancelledImmutable = await request(app.getHttpServer())
      .patch(`/api/v1/orders/${id}`)
      .send({ discount: 0 })
      .expect(409);
    assert.equal(cancelledImmutable.body.error.code, 'ORDER_NOT_EDITABLE');

    const invalidTransition = await request(app.getHttpServer())
      .patch(`/api/v1/orders/${id}/status`)
      .send({ status: 'confirmed' })
      .expect(409);
    assert.equal(invalidTransition.body.error.code, 'ORDER_INVALID_STATUS_TRANSITION');
    await request(app.getHttpServer()).get(`/api/v1/orders/${id}`).expect(200);
  });
});
