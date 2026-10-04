import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type {
  CreatePurchaseInput,
  CreateSupplierInput,
  InventoryItem,
  InventoryListQuery,
  PaginatedData,
  PurchaseDetails,
  PurchaseListItem,
  PurchaseListQuery,
  StockMovement,
  StockMovementListQuery,
  Supplier,
  SupplierListQuery,
  UpdateSupplierInput,
} from '@bazariya/shared';
import type { PoolClient } from 'pg';
import type { DatabaseService as DatabaseServiceContract } from '../../src/database/database.service.js';
import { InventoryDomainError } from '../../src/inventory/inventory.errors.js';
import type { InventoryRepository as InventoryRepositoryContract } from '../../src/inventory/inventory.repository.js';
import { calculateStockMovement } from '../../src/inventory/inventory.calculations.js';
import { PurchaseDomainError } from '../../src/purchases/purchases.errors.js';
import {
  type PurchaseProductSnapshot,
  type PurchaseWriteValues,
} from '../../src/purchases/purchases.repository.js';
import type { PurchasesRepository as PurchasesRepositoryContract } from '../../src/purchases/purchases.repository.js';
import type { SuppliersRepository as SuppliersRepositoryContract } from '../../src/suppliers/suppliers.repository.js';
import { calculatePurchaseTotals, mergeDuplicatePurchaseItems } from '../../src/purchases/purchases.calculations.js';
import { PG_POOL } from '../../src/database/database.constants.js';

process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://bazariya:bazariya_dev_only@localhost:5432/bazariya_test';

const [
  { AppModule },
  { configureApp },
  { DatabaseService },
  { InventoryRepository },
  { PurchasesRepository },
  { SuppliersRepository },
] = await Promise.all([
  import('../../src/app.module.js'),
  import('../../src/configure-app.js'),
  import('../../src/database/database.service.js'),
  import('../../src/inventory/inventory.repository.js'),
  import('../../src/purchases/purchases.repository.js'),
  import('../../src/suppliers/suppliers.repository.js'),
]);

const now = '2026-10-04T09:00:00.000Z';

interface TestProduct extends PurchaseProductSnapshot {
  isActive: boolean;
}

interface TransactionalParticipant {
  snapshot(): unknown;
  restore(snapshot: unknown): void;
}

function databaseError(code: string, constraint: string): Error & { code: string; constraint: string } {
  return Object.assign(new Error('private database details'), { code, constraint });
}

function toPage<T>(items: T[], page: number, pageSize: number, total: number): PaginatedData<T> {
  const offset = (page - 1) * pageSize;
  return {
    items: items.slice(offset, offset + pageSize),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

function statusFor(quantity: number, minimumQuantity: number): InventoryItem['status'] {
  if (quantity === 0) return 'out-of-stock';
  return quantity <= minimumQuantity ? 'low-stock' : 'in-stock';
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

class MemoryDatabase implements Pick<DatabaseServiceContract, 'query' | 'transaction' | 'ping' | 'onModuleDestroy'> {
  private tail = Promise.resolve();

  constructor(private readonly participants: TransactionalParticipant[]) {}

  async query(): Promise<never> {
    throw new Error('The Phase 6 API test should not make direct database queries.');
  }

  async ping(): Promise<void> {}

  async onModuleDestroy(): Promise<void> {}

  async transaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const previous = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    const snapshots = this.participants.map((participant) => participant.snapshot());
    try {
      return await operation({} as PoolClient);
    } catch (error) {
      this.participants.forEach((participant, index) => participant.restore(snapshots[index]));
      throw error;
    } finally {
      release();
    }
  }
}

class MemorySuppliersRepository implements Pick<
  SuppliersRepositoryContract,
  'list' | 'findById' | 'findForPurchase' | 'create' | 'update' | 'updateStatus' | 'hasPurchaseHistory' | 'delete'
>, TransactionalParticipant {
  private suppliers = new Map<string, Supplier>();
  private purchaseSuppliers = new Map<string, string>();

  reset(): void {
    this.suppliers.clear();
    this.purchaseSuppliers.clear();
  }

  snapshot(): unknown {
    return { suppliers: clone(this.suppliers), purchaseSuppliers: clone(this.purchaseSuppliers) };
  }

  restore(snapshot: unknown): void {
    const value = snapshot as { suppliers: Map<string, Supplier>; purchaseSuppliers: Map<string, string> };
    this.suppliers = value.suppliers;
    this.purchaseSuppliers = value.purchaseSuppliers;
  }

  findSync(id: string): Supplier | null {
    return this.suppliers.get(id) ?? null;
  }

  notePurchase(purchaseId: string, supplierId: string): void {
    this.purchaseSuppliers.set(purchaseId, supplierId);
  }

  async list(query: SupplierListQuery): Promise<PaginatedData<Supplier>> {
    const search = query.search?.toLocaleLowerCase('en-US');
    const filtered = [...this.suppliers.values()]
      .filter((supplier) => !search
        || supplier.name.toLocaleLowerCase('en-US').includes(search)
        || supplier.phone?.toLocaleLowerCase('en-US').includes(search)
        || supplier.email?.toLocaleLowerCase('en-US').includes(search))
      .filter((supplier) => query.status === undefined || supplier.isActive === (query.status === 'active'))
      .sort((left, right) => left.name.localeCompare(right.name, 'fa') || left.id.localeCompare(right.id));
    return toPage(filtered, query.page, query.pageSize, filtered.length);
  }

  async findById(id: string): Promise<Supplier | null> {
    return this.findSync(id);
  }

  async findForPurchase(_client: PoolClient, id: string): Promise<Supplier | null> {
    return this.findSync(id);
  }

  async create(input: CreateSupplierInput): Promise<Supplier> {
    const timestamp = new Date().toISOString();
    const supplier: Supplier = {
      id: randomUUID(),
      name: input.name,
      phone: input.phone ?? null,
      email: input.email ?? null,
      address: input.address ?? null,
      note: input.note ?? null,
      isActive: input.isActive ?? true,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.suppliers.set(supplier.id, supplier);
    return supplier;
  }

  async update(id: string, input: UpdateSupplierInput): Promise<Supplier | null> {
    const current = this.suppliers.get(id);
    if (!current) return null;
    const updated: Supplier = { ...current, ...input, updatedAt: new Date().toISOString() };
    this.suppliers.set(id, updated);
    return updated;
  }

  async updateStatus(id: string, isActive: boolean): Promise<Supplier | null> {
    const current = this.suppliers.get(id);
    if (!current) return null;
    const updated = { ...current, isActive, updatedAt: new Date().toISOString() };
    this.suppliers.set(id, updated);
    return updated;
  }

  async hasPurchaseHistory(id: string): Promise<boolean> {
    return [...this.purchaseSuppliers.values()].includes(id);
  }

  async delete(id: string): Promise<boolean> {
    if (await this.hasPurchaseHistory(id)) {
      throw databaseError('23503', 'purchases_supplier_id_fkey');
    }
    return this.suppliers.delete(id);
  }
}

class MemoryPurchasesRepository implements Pick<
  PurchasesRepositoryContract,
  | 'list'
  | 'findById'
  | 'findByIdForUpdate'
  | 'findByIdWithClient'
  | 'getActiveProductSnapshots'
  | 'createDraftWithClient'
  | 'updateDraftWithClient'
  | 'setStatusWithClient'
>, TransactionalParticipant {
  private purchases = new Map<string, PurchaseDetails>();
  private products = new Map<string, TestProduct>();
  private sequence = 0;

  constructor(
    private readonly suppliers: MemorySuppliersRepository,
  ) {}

  reset(): void {
    this.purchases.clear();
    this.products.clear();
    this.sequence = 0;
  }

  snapshot(): unknown {
    return { purchases: clone(this.purchases), sequence: this.sequence };
  }

  restore(snapshot: unknown): void {
    const value = snapshot as { purchases: Map<string, PurchaseDetails>; sequence: number };
    this.purchases = value.purchases;
    this.sequence = value.sequence;
  }

  addProduct(overrides: Partial<TestProduct> = {}): TestProduct {
    const product: TestProduct = {
      id: randomUUID(),
      name: 'چای ممتاز',
      sku: 'TEA-001',
      unit: 'pack',
      isActive: true,
      ...overrides,
    };
    this.products.set(product.id, product);
    return product;
  }

  renameProduct(id: string, changes: Partial<TestProduct>): void {
    const product = this.products.get(id);
    if (product) this.products.set(id, { ...product, ...changes });
  }

  async list(query: PurchaseListQuery): Promise<PaginatedData<PurchaseListItem>> {
    const search = query.search?.toLocaleLowerCase('en-US');
    const filtered = [...this.purchases.values()]
      .filter((purchase) => !query.supplierId || purchase.supplierId === query.supplierId)
      .filter((purchase) => !query.status || purchase.status === query.status)
      .filter((purchase) => !query.from || Date.parse(purchase.createdAt) >= Date.parse(query.from))
      .filter((purchase) => !query.to || Date.parse(purchase.createdAt) <= Date.parse(query.to))
      .filter((purchase) => !search
        || purchase.purchaseNumber.toLocaleLowerCase('en-US').includes(search)
        || purchase.supplier.name.toLocaleLowerCase('en-US').includes(search))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id));
    const start = (query.page - 1) * query.pageSize;
    return {
      items: filtered.slice(start, start + query.pageSize).map((purchase) => ({
        ...purchase,
        supplierName: purchase.supplier.name,
        itemCount: purchase.items.length,
      })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / query.pageSize),
      },
    };
  }

  async findById(id: string): Promise<PurchaseDetails | null> {
    const purchase = this.purchases.get(id);
    return purchase ? clone(purchase) : null;
  }

  async findByIdForUpdate(_client: PoolClient, id: string): Promise<PurchaseDetails | null> {
    return this.findById(id);
  }

  async findByIdWithClient(_client: PoolClient, id: string): Promise<PurchaseDetails | null> {
    return this.findById(id);
  }

  async getActiveProductSnapshots(
    _client: PoolClient,
    productIds: readonly string[],
  ): Promise<Map<string, PurchaseProductSnapshot>> {
    const snapshots = new Map<string, PurchaseProductSnapshot>();
    for (const id of [...new Set(productIds)].sort()) {
      const product = this.products.get(id);
      if (!product) throw new PurchaseDomainError('PRODUCT_NOT_FOUND', 'یکی از محصولات خرید پیدا نشد.', 404);
      if (!product.isActive) throw new PurchaseDomainError('PRODUCT_NOT_AVAILABLE', 'محصول غیرفعال است.', 409);
      snapshots.set(id, { id: product.id, name: product.name, sku: product.sku, unit: product.unit });
    }
    return snapshots;
  }

  async createDraftWithClient(_client: PoolClient, values: PurchaseWriteValues): Promise<PurchaseDetails> {
    this.sequence += 1;
    const id = randomUUID();
    const purchase: PurchaseDetails = {
      id,
      purchaseNumber: `PUR-${String(this.sequence).padStart(6, '0')}`,
      supplierId: values.supplierId,
      status: 'draft',
      subtotal: values.subtotal,
      discount: values.discount,
      total: values.total,
      note: values.note,
      createdAt: now,
      updatedAt: now,
      supplier: this.requireSupplier(values.supplierId),
      items: this.makeItems(id, values),
    };
    this.purchases.set(id, purchase);
    this.suppliers.notePurchase(id, values.supplierId);
    return clone(purchase);
  }

  async updateDraftWithClient(_client: PoolClient, id: string, values: PurchaseWriteValues): Promise<PurchaseDetails> {
    const current = this.purchases.get(id);
    if (!current) throw new Error('Purchase does not exist.');
    const purchase: PurchaseDetails = {
      ...current,
      supplierId: values.supplierId,
      supplier: this.requireSupplier(values.supplierId),
      note: values.note,
      subtotal: values.subtotal,
      discount: values.discount,
      total: values.total,
      updatedAt: new Date().toISOString(),
      items: this.makeItems(id, values),
    };
    this.purchases.set(id, purchase);
    this.suppliers.notePurchase(id, values.supplierId);
    return clone(purchase);
  }

  async setStatusWithClient(_client: PoolClient, id: string, status: 'confirmed' | 'cancelled'): Promise<PurchaseDetails> {
    const current = this.purchases.get(id);
    if (!current) throw new Error('Purchase does not exist.');
    const updated = { ...current, status, updatedAt: new Date().toISOString() };
    this.purchases.set(id, updated);
    return clone(updated);
  }

  private makeItems(purchaseId: string, values: PurchaseWriteValues): PurchaseDetails['items'] {
    return values.items.map((item) => ({
      id: randomUUID(),
      purchaseId,
      productId: item.id,
      productNameSnapshot: item.name,
      productSkuSnapshot: item.sku,
      unitSnapshot: item.unit,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    }));
  }

  private requireSupplier(id: string): PurchaseDetails['supplier'] {
    const supplier = this.suppliers.findSync(id);
    if (!supplier) throw new PurchaseDomainError('SUPPLIER_NOT_FOUND', 'تأمین‌کننده پیدا نشد.', 404);
    return {
      id: supplier.id,
      name: supplier.name,
      phone: supplier.phone,
      email: supplier.email,
      isActive: supplier.isActive,
    };
  }
}

class MemoryInventoryRepository implements Pick<
  InventoryRepositoryContract,
  | 'list'
  | 'findByProductId'
  | 'updateMinimum'
  | 'createMovement'
  | 'createMovementInTransaction'
  | 'assertProductsAvailableInTransaction'
  | 'listMovements'
>, TransactionalParticipant {
  private inventory = new Map<string, InventoryItem>();
  private movements = new Map<string, StockMovement[]>();

  private failMovementForProduct?: string;

  reset(): void {
    this.inventory.clear();
    this.movements.clear();
    this.failMovementForProduct = undefined;
  }

  snapshot(): unknown {
    return { inventory: clone(this.inventory), movements: clone(this.movements) };
  }

  restore(snapshot: unknown): void {
    const value = snapshot as { inventory: Map<string, InventoryItem>; movements: Map<string, StockMovement[]> };
    this.inventory = value.inventory;
    this.movements = value.movements;
  }

  addProduct(product: TestProduct, quantity = 7): void {
    this.inventory.set(product.id, {
      product: { id: product.id, name: product.name, sku: product.sku, unit: product.unit, isActive: product.isActive },
      quantity,
      minimumQuantity: 2,
      isLowStock: quantity <= 2,
      status: statusFor(quantity, 2),
      updatedAt: now,
    });
    this.movements.set(product.id, []);
  }

  allMovements(productId: string): StockMovement[] {
    return clone(this.movements.get(productId) ?? []);
  }

  setProductActive(productId: string, isActive: boolean): void {
    const current = this.inventory.get(productId);
    if (current) {
      this.inventory.set(productId, { ...current, product: { ...current.product, isActive } });
    }
  }

  failNextMovementFor(productId: string): void {
    this.failMovementForProduct = productId;
  }

  async list(query: InventoryListQuery): Promise<PaginatedData<InventoryItem>> {
    const items = [...this.inventory.values()]
      .filter((item) => !query.search || item.product.name.includes(query.search) || item.product.sku.includes(query.search))
      .filter((item) => !query.status || item.status === query.status)
      .filter((item) => query.lowStock === undefined || item.isLowStock === query.lowStock);
    return toPage(items, query.page, query.pageSize, items.length);
  }

  async findByProductId(id: string): Promise<InventoryItem | null> {
    return this.inventory.get(id) ?? null;
  }

  async updateMinimum(id: string, minimumQuantity: number): Promise<InventoryItem> {
    const current = this.requireInventory(id);
    const updated = {
      ...current,
      minimumQuantity,
      isLowStock: current.quantity <= minimumQuantity,
      status: statusFor(current.quantity, minimumQuantity),
      updatedAt: new Date().toISOString(),
    };
    this.inventory.set(id, updated);
    return updated;
  }

  async createMovement(id: string, input: { type: 'IN' | 'OUT' | 'ADJUSTMENT'; quantity: number; note?: string | null }) {
    return this.createMovementInTransaction({} as PoolClient, id, input);
  }

  async assertProductsAvailableInTransaction(_client: PoolClient, ids: readonly string[]): Promise<void> {
    for (const id of [...new Set(ids)].sort()) {
      const inventory = this.inventory.get(id);
      if (!inventory) throw new InventoryDomainError('PRODUCT_NOT_FOUND', 'محصول پیدا نشد.', 404);
      if (!inventory.product.isActive) throw new InventoryDomainError('PRODUCT_NOT_AVAILABLE', 'محصول غیرفعال است.', 409);
    }
  }

  async createMovementInTransaction(
    _client: PoolClient,
    id: string,
    input: { type: 'IN' | 'OUT' | 'ADJUSTMENT'; quantity: number; note?: string | null },
  ) {
    if (id === this.failMovementForProduct) {
      this.failMovementForProduct = undefined;
      throw new Error('Simulated stock movement failure.');
    }
    const current = this.requireInventory(id);
    if (!current.product.isActive) throw new InventoryDomainError('PRODUCT_NOT_AVAILABLE', 'محصول غیرفعال است.', 409);
    const calculated = calculateStockMovement(current.quantity, input);
    const updated: InventoryItem = {
      ...current,
      quantity: calculated.afterQuantity,
      isLowStock: calculated.afterQuantity <= current.minimumQuantity,
      status: statusFor(calculated.afterQuantity, current.minimumQuantity),
      updatedAt: new Date().toISOString(),
    };
    const movement: StockMovement = {
      id: randomUUID(),
      productId: id,
      type: calculated.type,
      quantity: calculated.quantity,
      beforeQuantity: calculated.beforeQuantity,
      afterQuantity: calculated.afterQuantity,
      note: input.note ?? null,
      createdAt: updated.updatedAt,
    };
    this.inventory.set(id, updated);
    this.movements.get(id)?.push(movement);
    return { inventory: updated, movement };
  }

  async listMovements(id: string, query: StockMovementListQuery): Promise<PaginatedData<StockMovement>> {
    const items = [...(this.movements.get(id) ?? [])]
      .filter((movement) => !query.type || movement.type === query.type)
      .filter((movement) => !query.from || Date.parse(movement.createdAt) >= Date.parse(query.from))
      .filter((movement) => !query.to || Date.parse(movement.createdAt) <= Date.parse(query.to));
    return toPage(items, query.page, query.pageSize, items.length);
  }

  private requireInventory(id: string): InventoryItem {
    const item = this.inventory.get(id);
    if (!item) throw new InventoryDomainError('PRODUCT_NOT_FOUND', 'محصول پیدا نشد.', 404);
    return item;
  }
}

describe('Purchase calculations', () => {
  it('merges repeated products deterministically and calculates integer Toman totals', () => {
    const productId = randomUUID();
    const items = mergeDuplicatePurchaseItems([
      { productId, quantity: 2, unitPrice: 35_000 },
      { productId, quantity: 3, unitPrice: 35_000 },
    ]);
    assert.deepEqual(items, [{ productId, quantity: 5, unitPrice: 35_000 }]);
    assert.deepEqual(calculatePurchaseTotals(items, 5_000), {
      subtotal: 175_000,
      discount: 5_000,
      total: 170_000,
      lineTotals: [175_000],
    });
  });

  it('rejects conflicting duplicate prices, invalid quantities, discounts, and unsafe totals', () => {
    const productId = randomUUID();
    assert.throws(
      () => mergeDuplicatePurchaseItems([
        { productId, quantity: 1, unitPrice: 10 },
        { productId, quantity: 1, unitPrice: 11 },
      ]),
      (error: unknown) => error instanceof PurchaseDomainError && error.code === 'DUPLICATE_PRODUCT_PRICE_MISMATCH',
    );
    assert.throws(() => mergeDuplicatePurchaseItems([{ productId, quantity: 0, unitPrice: 10 }]), /عدد صحیح مثبت/);
    assert.throws(() => mergeDuplicatePurchaseItems([{ productId, quantity: 1, unitPrice: -1 }]), /عدد صحیح نامنفی/);
    assert.throws(() => calculatePurchaseTotals([{ quantity: 1, unitPrice: 10 }], 11), /تخفیف/);
    assert.throws(
      () => calculatePurchaseTotals([{ quantity: Number.MAX_SAFE_INTEGER, unitPrice: 2 }], 0),
      /محدودهٔ امن/,
    );
  });
});

describe('Suppliers and Purchases API', () => {
  let app: INestApplication;
  let suppliers: MemorySuppliersRepository;
  let purchases: MemoryPurchasesRepository;
  let inventory: MemoryInventoryRepository;

  before(async () => {
    suppliers = new MemorySuppliersRepository();
    purchases = new MemoryPurchasesRepository(suppliers);
    inventory = new MemoryInventoryRepository();
    const database = new MemoryDatabase([suppliers, purchases, inventory]);
    const pool = {
      query: async () => ({ rows: [], rowCount: 0 }),
      connect: async () => { throw new Error('Phase 6 API test must use the memory transaction provider.'); },
      end: async () => undefined,
    };
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PG_POOL)
      .useValue(pool)
      .overrideProvider(DatabaseService)
      .useValue(database)
      .overrideProvider(SuppliersRepository)
      .useValue(suppliers)
      .overrideProvider(PurchasesRepository)
      .useValue(purchases)
      .overrideProvider(InventoryRepository)
      .useValue(inventory)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app, 'http://localhost:5173');
    await app.init();
  });

  after(async () => {
    await app.close();
  });

  beforeEach(() => {
    suppliers.reset();
    purchases.reset();
    inventory.reset();
  });

  async function createSupplier(name = 'تأمین‌کنندهٔ نمونه'): Promise<Supplier> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/suppliers')
      .send({ name })
      .expect(201);
    return response.body.data as Supplier;
  }

  function addProduct(overrides: Partial<TestProduct> = {}, quantity = 7): TestProduct {
    const product = purchases.addProduct(overrides);
    inventory.addProduct(product, quantity);
    return product;
  }

  it('creates, updates, searches, paginates, and deactivates Suppliers', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/suppliers')
      .send({ name: '  شرکت چای بهار  ', phone: ' 0912-0000000 ', email: ' ORDERS@EXAMPLE.TEST ', address: ' تهران ', note: ' تماس عصر ' })
      .expect(201);
    const supplier = created.body.data as Supplier;
    assert.equal(supplier.name, 'شرکت چای بهار');
    assert.equal(supplier.phone, '0912-0000000');
    assert.equal(supplier.email, 'orders@example.test');
    assert.equal(supplier.address, 'تهران');
    assert.equal(supplier.note, 'تماس عصر');

    const second = await request(app.getHttpServer())
      .post('/api/v1/suppliers')
      .send({ name: 'پخش خانه', phone: '021-33445566' })
      .expect(201);
    await request(app.getHttpServer()).patch(`/api/v1/suppliers/${second.body.data.id}/status`).send({ isActive: false }).expect(200);

    const searched = await request(app.getHttpServer())
      .get('/api/v1/suppliers')
      .query({ search: 'example.test', status: 'active', page: 1, pageSize: 1 })
      .expect(200);
    assert.deepEqual(searched.body.data.items.map((item: Supplier) => item.id), [supplier.id]);
    assert.deepEqual(searched.body.data.pagination, { page: 1, pageSize: 1, total: 1, totalPages: 1 });

    const inactive = await request(app.getHttpServer())
      .get('/api/v1/suppliers')
      .query({ search: '33445566', status: 'inactive' })
      .expect(200);
    assert.equal(inactive.body.data.items[0].id, second.body.data.id);

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/suppliers/${supplier.id}`)
      .send({ name: 'شرکت چای بهار نو', email: null })
      .expect(200);
    assert.equal(updated.body.data.name, 'شرکت چای بهار نو');
    assert.equal(updated.body.data.email, null);
    assert.equal((await request(app.getHttpServer()).get(`/api/v1/suppliers/${supplier.id}`).expect(200)).body.data.name, 'شرکت چای بهار نو');

    await request(app.getHttpServer()).delete(`/api/v1/suppliers/${supplier.id}`).expect(200);
    await request(app.getHttpServer()).get(`/api/v1/suppliers/${supplier.id}`).expect(404);
  });

  it('rejects invalid Supplier input and keeps suppliers with Purchase history', async () => {
    for (const body of [{}, { name: 'x' }, { name: 'فروشنده', email: 'نامعتبر' }, { name: 'فروشنده', unexpected: true }]) {
      const response = await request(app.getHttpServer()).post('/api/v1/suppliers').send(body).expect(400);
      assert.ok(response.body.error.code);
    }

    const supplier = await createSupplier();
    const product = addProduct();
    await request(app.getHttpServer())
      .post('/api/v1/purchases')
      .send({ supplierId: supplier.id, items: [{ productId: product.id, quantity: 1, unitPrice: 100 }] })
      .expect(201);

    const conflict = await request(app.getHttpServer()).delete(`/api/v1/suppliers/${supplier.id}`).expect(409);
    assert.equal(conflict.body.error.code, 'SUPPLIER_HAS_PURCHASE_HISTORY');
    assert.equal((await request(app.getHttpServer()).get(`/api/v1/suppliers/${supplier.id}`).expect(200)).body.data.id, supplier.id);
  });

  it('creates Purchases with server-calculated Toman totals, merged items, generated numbers, and immutable Product snapshots', async () => {
    const supplier = await createSupplier();
    const tea = addProduct({ name: 'چای ممتاز', sku: 'TEA-01', unit: 'pack' });
    const sugar = addProduct({ name: 'شکر سفید', sku: 'SUG-01', unit: 'kilogram' });
    const response = await request(app.getHttpServer())
      .post('/api/v1/purchases')
      .send({
        supplierId: supplier.id,
        items: [
          { productId: tea.id, quantity: 2, unitPrice: 35_000 },
          { productId: sugar.id, quantity: 4, unitPrice: 2_000 },
          { productId: tea.id, quantity: 3, unitPrice: 35_000 },
        ],
        discount: 5_000,
        note: '  خرید آزمایشی  ',
      })
      .expect(201);

    const purchase = response.body.data as PurchaseDetails;
    assert.match(purchase.purchaseNumber, /^PUR-\d{6,19}$/);
    assert.equal(purchase.status, 'draft');
    assert.equal(purchase.note, 'خرید آزمایشی');
    assert.equal(purchase.subtotal, 183_000);
    assert.equal(purchase.discount, 5_000);
    assert.equal(purchase.total, 178_000);
    assert.equal(purchase.items.length, 2);
    const teaItem = purchase.items.find((item) => item.productId === tea.id);
    assert.deepEqual(
      teaItem && {
        productNameSnapshot: teaItem.productNameSnapshot,
        productSkuSnapshot: teaItem.productSkuSnapshot,
        unitSnapshot: teaItem.unitSnapshot,
        quantity: teaItem.quantity,
        unitPrice: teaItem.unitPrice,
        lineTotal: teaItem.lineTotal,
      },
      {
        productNameSnapshot: 'چای ممتاز',
        productSkuSnapshot: 'TEA-01',
        unitSnapshot: 'pack',
        quantity: 5,
        unitPrice: 35_000,
        lineTotal: 175_000,
      },
    );
    assert.equal((await request(app.getHttpServer()).post('/api/v1/purchases').send({
      supplierId: supplier.id,
      items: [{ productId: sugar.id, quantity: 1, unitPrice: 2_000 }],
    }).expect(201)).body.data.purchaseNumber, 'PUR-000002');

    purchases.renameProduct(tea.id, { name: 'نام جدید', sku: 'TEA-NEW', unit: 'piece' });
    const fetched = (await request(app.getHttpServer()).get(`/api/v1/purchases/${purchase.id}`).expect(200)).body.data as PurchaseDetails;
    const savedTea = fetched.items.find((item) => item.productId === tea.id);
    assert.deepEqual(
      savedTea && [savedTea.productNameSnapshot, savedTea.productSkuSnapshot, savedTea.unitSnapshot],
      ['چای ممتاز', 'TEA-01', 'pack'],
    );
  });

  it('validates suppliers, active products, integer quantities and prices, duplicate policies, discounts, and server-owned fields', async () => {
    const supplier = await createSupplier();
    const product = addProduct();
    const base: CreatePurchaseInput = {
      supplierId: supplier.id,
      items: [{ productId: product.id, quantity: 1, unitPrice: 100 }],
    };
    const invalidBodies: unknown[] = [
      { ...base, subtotal: 100 },
      { ...base, items: [{ ...base.items[0], lineTotal: 100 }] },
      { ...base, items: [{ productId: product.id, quantity: 1.25, unitPrice: 100 }] },
      { ...base, items: [{ productId: product.id, quantity: 1, unitPrice: -1 }] },
      { ...base, items: [{ productId: product.id, quantity: 1, unitPrice: 1.5 }] },
      { ...base, discount: null },
      { ...base, discount: 101 },
      { ...base, items: [] },
      { ...base, items: [{ productId: product.id, quantity: 1 }] },
    ];
    for (const body of invalidBodies) {
      const response = await request(app.getHttpServer()).post('/api/v1/purchases').send(body as object).expect(400);
      assert.ok(response.body.error.code);
    }

    const mismatch = await request(app.getHttpServer())
      .post('/api/v1/purchases')
      .send({
        supplierId: supplier.id,
        items: [
          { productId: product.id, quantity: 1, unitPrice: 100 },
          { productId: product.id, quantity: 1, unitPrice: 101 },
        ],
      })
      .expect(400);
    assert.equal(mismatch.body.error.code, 'DUPLICATE_PRODUCT_PRICE_MISMATCH');

    const inactiveSupplier = (await request(app.getHttpServer()).post('/api/v1/suppliers').send({ name: 'غیرفعال' }).expect(201)).body.data as Supplier;
    await request(app.getHttpServer()).patch(`/api/v1/suppliers/${inactiveSupplier.id}/status`).send({ isActive: false }).expect(200);
    const unavailableSupplier = await request(app.getHttpServer())
      .post('/api/v1/purchases')
      .send({ ...base, supplierId: inactiveSupplier.id })
      .expect(409);
    assert.equal(unavailableSupplier.body.error.code, 'SUPPLIER_NOT_ACTIVE');

    const inactiveProduct = addProduct({ name: 'ناموجود', isActive: false });
    const unavailableProduct = await request(app.getHttpServer())
      .post('/api/v1/purchases')
      .send({ supplierId: supplier.id, items: [{ productId: inactiveProduct.id, quantity: 1, unitPrice: 50 }] })
      .expect(409);
    assert.equal(unavailableProduct.body.error.code, 'PRODUCT_NOT_AVAILABLE');

    const missingProduct = await request(app.getHttpServer())
      .post('/api/v1/purchases')
      .send({ supplierId: supplier.id, items: [{ productId: randomUUID(), quantity: 1, unitPrice: 50 }] })
      .expect(404);
    assert.equal(missingProduct.body.error.code, 'PRODUCT_NOT_FOUND');
  });

  it('updates draft supplier, items, prices, quantities, discounts and notes, then cancels without stock movement', async () => {
    const supplier = await createSupplier('تأمین‌کنندهٔ اول');
    const otherSupplier = await createSupplier('تأمین‌کنندهٔ دوم');
    const product = addProduct({ name: 'چای ویژه', sku: 'TEA-02' }, 10);
    const created = await request(app.getHttpServer())
      .post('/api/v1/purchases')
      .send({ supplierId: supplier.id, items: [{ productId: product.id, quantity: 2, unitPrice: 1_000 }] })
      .expect(201);
    const id = created.body.data.id as string;
    purchases.renameProduct(product.id, { name: 'نام جدید محصول', sku: 'TEA-02-NEW', unit: 'kilogram' });

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/purchases/${id}`)
      .send({
        supplierId: otherSupplier.id,
        items: [{ productId: product.id, quantity: 3, unitPrice: 1_500 }],
        discount: 500,
        note: 'ویرایش پیش‌نویس',
      })
      .expect(200);
    assert.equal(updated.body.data.supplierId, otherSupplier.id);
    assert.equal(updated.body.data.subtotal, 4_500);
    assert.equal(updated.body.data.discount, 500);
    assert.equal(updated.body.data.total, 4_000);
    assert.equal(updated.body.data.items[0].quantity, 3);
    assert.equal(updated.body.data.items[0].unitPrice, 1_500);
    assert.deepEqual(
      [updated.body.data.items[0].productNameSnapshot, updated.body.data.items[0].productSkuSnapshot, updated.body.data.items[0].unitSnapshot],
      ['چای ویژه', 'TEA-02', 'pack'],
    );
    assert.equal(updated.body.data.note, 'ویرایش پیش‌نویس');

    const noOp = await request(app.getHttpServer()).patch(`/api/v1/purchases/${id}`).send({}).expect(400);
    assert.equal(noOp.body.error.code, 'PURCHASE_INVALID');

    const cancelled = await request(app.getHttpServer())
      .patch(`/api/v1/purchases/${id}/status`)
      .send({ status: 'cancelled' })
      .expect(200);
    assert.equal(cancelled.body.data.status, 'cancelled');
    assert.equal((await inventory.findByProductId(product.id))?.quantity, 10);
    assert.equal(inventory.allMovements(product.id).length, 0);

    const immutable = await request(app.getHttpServer()).patch(`/api/v1/purchases/${id}`).send({ discount: 0 }).expect(409);
    assert.equal(immutable.body.error.code, 'PURCHASE_NOT_EDITABLE');
    const cannotConfirm = await request(app.getHttpServer())
      .patch(`/api/v1/purchases/${id}/status`)
      .send({ status: 'confirmed' })
      .expect(409);
    assert.equal(cannotConfirm.body.error.code, 'PURCHASE_NOT_CONFIRMABLE');
    await request(app.getHttpServer()).delete(`/api/v1/purchases/${id}`).expect(404);
  });

  it('revalidates Product status at confirmation and leaves stock untouched when a Product is inactive', async () => {
    const supplier = await createSupplier();
    const product = addProduct({ name: 'چای غیرفعال‌شده', sku: 'TEA-INACTIVE' }, 6);
    const created = await request(app.getHttpServer())
      .post('/api/v1/purchases')
      .send({ supplierId: supplier.id, items: [{ productId: product.id, quantity: 2, unitPrice: 1_200 }] })
      .expect(201);
    purchases.renameProduct(product.id, { isActive: false });
    inventory.setProductActive(product.id, false);

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/purchases/${created.body.data.id}/status`)
      .send({ status: 'confirmed' })
      .expect(409);
    assert.equal(response.body.error.code, 'PRODUCT_NOT_AVAILABLE');
    assert.equal((await request(app.getHttpServer()).get(`/api/v1/purchases/${created.body.data.id}`).expect(200)).body.data.status, 'draft');
    assert.equal((await inventory.findByProductId(product.id))?.quantity, 6);
    assert.equal(inventory.allMovements(product.id).length, 0);
  });

  it('rolls back every inventory movement when any item fails during confirmation', async () => {
    const supplier = await createSupplier();
    const tea = addProduct({ name: 'چای', sku: 'TEA-ATOMIC' }, 5);
    const sugar = addProduct({ name: 'شکر', sku: 'SUGAR-ATOMIC' }, 8);
    const orderedProducts = [tea, sugar].sort((left, right) => left.id.localeCompare(right.id));
    const created = await request(app.getHttpServer())
      .post('/api/v1/purchases')
      .send({
        supplierId: supplier.id,
        items: [
          { productId: tea.id, quantity: 2, unitPrice: 1_000 },
          { productId: sugar.id, quantity: 3, unitPrice: 500 },
        ],
      })
      .expect(201);
    inventory.failNextMovementFor(orderedProducts[1]!.id);

    await request(app.getHttpServer())
      .patch(`/api/v1/purchases/${created.body.data.id}/status`)
      .send({ status: 'confirmed' })
      .expect(500);
    const purchase = (await request(app.getHttpServer()).get(`/api/v1/purchases/${created.body.data.id}`).expect(200)).body.data as PurchaseDetails;
    assert.equal(purchase.status, 'draft');
    assert.equal((await inventory.findByProductId(tea.id))?.quantity, 5);
    assert.equal((await inventory.findByProductId(sugar.id))?.quantity, 8);
    assert.equal(inventory.allMovements(tea.id).length + inventory.allMovements(sugar.id).length, 0);
  });

  it('confirms concurrent requests once, atomically creates referenced IN movements, and keeps the confirmed Purchase immutable', async () => {
    const supplier = await createSupplier();
    const tea = addProduct({ name: 'چای سبز', sku: 'TEA-GREEN', unit: 'pack' }, 5);
    const sugar = addProduct({ name: 'شکر', sku: 'SUGAR', unit: 'kilogram' }, 8);
    const created = await request(app.getHttpServer())
      .post('/api/v1/purchases')
      .send({
        supplierId: supplier.id,
        items: [
          { productId: sugar.id, quantity: 3, unitPrice: 1_000 },
          { productId: tea.id, quantity: 4, unitPrice: 2_000 },
        ],
      })
      .expect(201);
    const id = created.body.data.id as string;
    const purchaseNumber = created.body.data.purchaseNumber as string;

    const confirmationRequests = await Promise.all([
      request(app.getHttpServer()).patch(`/api/v1/purchases/${id}/status`).send({ status: 'confirmed' }),
      request(app.getHttpServer()).patch(`/api/v1/purchases/${id}/status`).send({ status: 'confirmed' }),
    ]);
    assert.deepEqual(confirmationRequests.map((response) => response.status).sort(), [200, 409]);
    const conflict = confirmationRequests.find((response) => response.status === 409);
    assert.equal(conflict?.body.error.code, 'PURCHASE_ALREADY_CONFIRMED');
    const confirmed = confirmationRequests.find((response) => response.status === 200)?.body.data as PurchaseDetails;
    assert.equal(confirmed.status, 'confirmed');

    assert.equal((await inventory.findByProductId(tea.id))?.quantity, 9);
    assert.equal((await inventory.findByProductId(sugar.id))?.quantity, 11);
    for (const [productId, quantity] of [[tea.id, 4], [sugar.id, 3]] as const) {
      const movements = inventory.allMovements(productId);
      assert.equal(movements.length, 1);
      assert.equal(movements[0]?.type, 'IN');
      assert.equal(movements[0]?.quantity, quantity);
      assert.equal(movements[0]?.note, `Purchase ${purchaseNumber}`);
    }

    const updateConflict = await request(app.getHttpServer()).patch(`/api/v1/purchases/${id}`).send({ note: 'تغییر' }).expect(409);
    assert.equal(updateConflict.body.error.code, 'PURCHASE_NOT_EDITABLE');
    const cancelConflict = await request(app.getHttpServer())
      .patch(`/api/v1/purchases/${id}/status`)
      .send({ status: 'cancelled' })
      .expect(409);
    assert.equal(cancelConflict.body.error.code, 'PURCHASE_NOT_CONFIRMABLE');
    await request(app.getHttpServer()).get(`/api/v1/purchases/${id}`).expect(200);
  });

  it('lists Purchases with supplier, status, timezone-safe date and search filters', async () => {
    const supplier = await createSupplier('پخش چای');
    const product = addProduct();
    const created = await request(app.getHttpServer())
      .post('/api/v1/purchases')
      .send({ supplierId: supplier.id, items: [{ productId: product.id, quantity: 1, unitPrice: 900 }] })
      .expect(201);
    const purchase = created.body.data as PurchaseDetails;
    const filtered = await request(app.getHttpServer())
      .get('/api/v1/purchases')
      .query({
        search: 'پخش چای',
        supplierId: supplier.id,
        status: 'draft',
        from: '2026-01-01T00:00:00+03:30',
        to: '2027-01-01T00:00:00+03:30',
        page: 1,
        pageSize: 1,
      })
      .expect(200);
    assert.deepEqual(filtered.body.data.items.map((item: PurchaseListItem) => item.id), [purchase.id]);
    assert.deepEqual(filtered.body.data.pagination, { page: 1, pageSize: 1, total: 1, totalPages: 1 });

    const missingZone = await request(app.getHttpServer())
      .get('/api/v1/purchases?from=2026-01-01T00:00:00')
      .expect(400);
    assert.equal(missingZone.body.error.code, 'VALIDATION_ERROR');
    const reversed = await request(app.getHttpServer())
      .get('/api/v1/purchases')
      .query({ from: '2027-01-01T00:00:00Z', to: '2026-01-01T00:00:00Z' })
      .expect(400);
    assert.equal(reversed.body.error.code, 'PURCHASE_DATE_RANGE_INVALID');
  });
});
