import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type {
  CreateStockMovementInput,
  CreateStockMovementResult,
  InventoryItem,
  InventoryListQuery,
  PaginatedData,
  StockMovement,
  StockMovementListQuery,
} from '@bazariya/shared';
import type { InventoryRepository as InventoryRepositoryContract } from '../../src/inventory/inventory.repository.js';
import { InventoryDomainError } from '../../src/inventory/inventory.errors.js';
import { calculateStockMovement } from '../../src/inventory/inventory.calculations.js';
import { PG_POOL } from '../../src/database/database.constants.js';
import type { DatabaseService } from '../../src/database/database.service.js';

process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://bazariya:bazariya_dev_only@localhost:5432/bazariya_test';

const [{ AppModule }, { configureApp }, { InventoryRepository }] = await Promise.all([
  import('../../src/app.module.js'),
  import('../../src/configure-app.js'),
  import('../../src/inventory/inventory.repository.js'),
]);

const now = '2026-10-04T09:00:00.000Z';

function makeInventory(overrides: Partial<InventoryItem> & {
  productOverrides?: Partial<InventoryItem['product']>;
} = {}): InventoryItem {
  const { productOverrides, ...inventoryOverrides } = overrides;
  const quantity = inventoryOverrides.quantity ?? 10;
  const minimumQuantity = inventoryOverrides.minimumQuantity ?? 3;
  const status = quantity === 0 ? 'out-of-stock' : quantity <= minimumQuantity ? 'low-stock' : 'in-stock';
  return {
    product: {
      id: randomUUID(),
      name: 'چای ممتاز',
      sku: 'TEA-001',
      unit: 'pack',
      isActive: true,
      ...productOverrides,
    },
    quantity,
    minimumQuantity,
    isLowStock: quantity <= minimumQuantity,
    status,
    updatedAt: now,
    ...inventoryOverrides,
  };
}

function toPage<T>(items: T[], page: number, pageSize: number, total: number): PaginatedData<T> {
  const offset = (page - 1) * pageSize;
  return {
    items: items.slice(offset, offset + pageSize),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

class MemoryInventoryRepository implements Pick<
  InventoryRepositoryContract,
  'list' | 'findByProductId' | 'updateMinimum' | 'createMovement' | 'listMovements'
> {
  private readonly inventory = new Map<string, InventoryItem>();
  private readonly movements = new Map<string, StockMovement[]>();
  private readonly locks = new Map<string, Promise<void>>();

  reset(): void {
    this.inventory.clear();
    this.movements.clear();
    this.locks.clear();
  }

  add(item: InventoryItem): void {
    this.inventory.set(item.product.id, item);
    this.movements.set(item.product.id, []);
  }

  allMovements(productId: string): StockMovement[] {
    return [...(this.movements.get(productId) ?? [])];
  }

  async list(query: InventoryListQuery): Promise<PaginatedData<InventoryItem>> {
    const search = query.search?.toLocaleLowerCase('fa');
    const filtered = [...this.inventory.values()]
      .filter((item) => !search
        || item.product.name.toLocaleLowerCase('fa').includes(search)
        || item.product.sku.toLocaleLowerCase('fa').includes(search))
      .filter((item) => !query.status || item.status === query.status)
      .filter((item) => query.lowStock === undefined || item.isLowStock === query.lowStock)
      .sort((left, right) => left.product.name.localeCompare(right.product.name, 'fa'));
    return toPage(filtered, query.page, query.pageSize, filtered.length);
  }

  async findByProductId(productId: string): Promise<InventoryItem | null> {
    return this.inventory.get(productId) ?? null;
  }

  async updateMinimum(productId: string, minimumQuantity: number): Promise<InventoryItem> {
    return this.withLock(productId, async () => {
      const item = this.requireInventory(productId);
      const updated: InventoryItem = {
        ...item,
        minimumQuantity,
        isLowStock: item.quantity <= minimumQuantity,
        status: this.statusFor(item.quantity, minimumQuantity),
        updatedAt: new Date().toISOString(),
      };
      this.inventory.set(productId, updated);
      return updated;
    });
  }

  async createMovement(productId: string, input: CreateStockMovementInput): Promise<CreateStockMovementResult> {
    return this.withLock(productId, async () => {
      const item = this.requireInventory(productId);
      if (!item.product.isActive) {
        throw new InventoryDomainError('PRODUCT_NOT_AVAILABLE', 'ثبت گردش موجودی برای محصول غیرفعال امکان‌پذیر نیست.', 409);
      }
      const calculated = calculateStockMovement(item.quantity, input);
      const updated: InventoryItem = {
        ...item,
        quantity: calculated.afterQuantity,
        isLowStock: calculated.afterQuantity <= item.minimumQuantity,
        status: this.statusFor(calculated.afterQuantity, item.minimumQuantity),
        updatedAt: new Date().toISOString(),
      };
      const movement: StockMovement = {
        id: randomUUID(),
        productId,
        type: calculated.type,
        quantity: calculated.quantity,
        beforeQuantity: calculated.beforeQuantity,
        afterQuantity: calculated.afterQuantity,
        note: input.note ?? null,
        createdAt: updated.updatedAt,
      };
      this.inventory.set(productId, updated);
      this.movements.get(productId)?.push(movement);
      return { inventory: updated, movement };
    });
  }

  async listMovements(productId: string, query: StockMovementListQuery): Promise<PaginatedData<StockMovement>> {
    const filtered = [...(this.movements.get(productId) ?? [])]
      .filter((movement) => !query.type || movement.type === query.type)
      .filter((movement) => !query.from || Date.parse(movement.createdAt) >= Date.parse(query.from))
      .filter((movement) => !query.to || Date.parse(movement.createdAt) <= Date.parse(query.to))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id));
    return toPage(filtered, query.page, query.pageSize, filtered.length);
  }

  private requireInventory(productId: string): InventoryItem {
    const item = this.inventory.get(productId);
    if (!item) throw new InventoryDomainError('PRODUCT_NOT_FOUND', 'محصول موردنظر پیدا نشد.', 404);
    return item;
  }

  private statusFor(quantity: number, minimumQuantity: number): InventoryItem['status'] {
    if (quantity === 0) return 'out-of-stock';
    return quantity <= minimumQuantity ? 'low-stock' : 'in-stock';
  }

  private async withLock<T>(productId: string, operation: () => Promise<T>): Promise<T> {
    const predecessor = this.locks.get(productId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => { release = resolve; });
    this.locks.set(productId, current);
    await predecessor;
    try {
      return await operation();
    } finally {
      release();
      if (this.locks.get(productId) === current) this.locks.delete(productId);
    }
  }
}

class ScriptedDatabase {
  readonly statements: string[] = [];
  shouldFailMovementInsert = false;
  productIsActive = true;
  quantity = 8;
  minimumQuantity = 2;
  transactionOutcome: string[] = [];

  async query(): Promise<{ rows: unknown[]; rowCount: number }> {
    throw new Error('The scripted inventory repository test should use a transaction client.');
  }

  async transaction<T>(operation: (client: never) => Promise<T>): Promise<T> {
    const quantityBefore = this.quantity;
    const minimumBefore = this.minimumQuantity;
    this.transactionOutcome.push('BEGIN');
    const client = {
      query: async <Row extends Record<string, unknown> = Record<string, unknown>>(statement: string, values?: unknown[]): Promise<{ rows: Row[]; rowCount: number }> => {
        this.statements.push(statement.trim().replace(/\s+/g, ' '));
        if (statement.includes('FROM bazariya.products') && statement.includes('FOR SHARE')) {
          return { rows: [{ id: 'product-1', isActive: this.productIsActive } as unknown as Row], rowCount: 1 };
        }
        if (statement.includes('INSERT INTO bazariya.inventory')) return { rows: [], rowCount: 1 };
        if (statement.includes('FROM bazariya.inventory') && statement.includes('FOR UPDATE')) {
          return { rows: [{ quantity: String(this.quantity), minimumQuantity: String(this.minimumQuantity) } as unknown as Row], rowCount: 1 };
        }
        if (statement.includes('UPDATE bazariya.inventory')) {
          this.quantity = Number(values?.[1]);
          return { rows: [], rowCount: 1 };
        }
        if (statement.includes('INSERT INTO bazariya.stock_movements')) {
          if (this.shouldFailMovementInsert) throw new Error('Movement insert failed.');
          const nowDate = new Date(now);
          return {
            rows: [{
              id: 'movement-1',
              productId: 'product-1',
              type: 'IN',
              quantity: '3',
              beforeQuantity: String(this.quantity - 3),
              afterQuantity: String(this.quantity),
              note: null,
              createdAt: nowDate,
            } as unknown as Row],
            rowCount: 1,
          };
        }
        if (statement.includes('FROM bazariya.products p') && statement.includes('LEFT JOIN bazariya.inventory')) {
          return {
            rows: [{
              productId: 'product-1',
              productName: 'چای ممتاز',
              productSku: 'TEA-001',
              productUnit: 'piece',
              productIsActive: true,
              quantity: String(this.quantity),
              minimumQuantity: String(this.minimumQuantity),
              isLowStock: this.quantity <= this.minimumQuantity,
              status: this.quantity === 0 ? 'out-of-stock' : this.quantity <= this.minimumQuantity ? 'low-stock' : 'in-stock',
              updatedAt: new Date(now),
            } as unknown as Row],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      },
    };
    try {
      const result = await operation(client as never);
      this.transactionOutcome.push('COMMIT');
      return result;
    } catch (error) {
      this.quantity = quantityBefore;
      this.minimumQuantity = minimumBefore;
      this.transactionOutcome.push('ROLLBACK');
      throw error;
    }
  }
}

describe('Inventory movement calculations', () => {
  it('treats adjustments as a target quantity and stores the absolute delta', () => {
    assert.deepEqual(calculateStockMovement(12, { type: 'ADJUSTMENT', quantity: 4 }), {
      type: 'ADJUSTMENT', quantity: 8, beforeQuantity: 12, afterQuantity: 4,
    });
    assert.deepEqual(calculateStockMovement(0, { type: 'ADJUSTMENT', quantity: 0 }), {
      type: 'ADJUSTMENT', quantity: 0, beforeQuantity: 0, afterQuantity: 0,
    });
    assert.throws(() => calculateStockMovement(3, { type: 'OUT', quantity: 4 }), (error: unknown) =>
      error instanceof InventoryDomainError && error.code === 'INSUFFICIENT_STOCK');
    assert.deepEqual(calculateStockMovement(0, { type: 'IN', quantity: Number.MAX_SAFE_INTEGER }), {
      type: 'IN', quantity: Number.MAX_SAFE_INTEGER, beforeQuantity: 0, afterQuantity: Number.MAX_SAFE_INTEGER,
    });
    assert.deepEqual(calculateStockMovement(Number.MAX_SAFE_INTEGER, { type: 'OUT', quantity: Number.MAX_SAFE_INTEGER }), {
      type: 'OUT', quantity: Number.MAX_SAFE_INTEGER, beforeQuantity: Number.MAX_SAFE_INTEGER, afterQuantity: 0,
    });
    assert.throws(() => calculateStockMovement(3, { type: 'IN', quantity: Number.MAX_SAFE_INTEGER }), /موجودی/);
  });
});

describe('Inventory repository transactions', () => {
  it('updates stock and snapshots before/after values inside one committed transaction', async () => {
    const database = new ScriptedDatabase();
    const repository = new InventoryRepository(database as unknown as DatabaseService);
    const result = await repository.createMovement('product-1', { type: 'IN', quantity: 3 });

    assert.deepEqual(database.transactionOutcome, ['BEGIN', 'COMMIT']);
    assert.ok(database.statements[0]?.includes('FOR SHARE'), 'The product must be locked before inventory is mutated.');
    assert.ok(database.statements.some((statement) => statement.includes('FOR UPDATE')), 'The current inventory row must be locked.');
    assert.ok(database.statements.some((statement) => statement.includes('UPDATE bazariya.inventory')));
    assert.ok(database.statements.some((statement) => statement.includes('INSERT INTO bazariya.stock_movements')));
    assert.equal(result.movement.beforeQuantity, 8);
    assert.equal(result.movement.afterQuantity, 11);
    assert.equal(result.movement.quantity, 3);
    assert.equal(result.inventory.quantity, 11);
  });

  it('rolls back stock changes when writing the movement history fails', async () => {
    const database = new ScriptedDatabase();
    database.shouldFailMovementInsert = true;
    const repository = new InventoryRepository(database as unknown as DatabaseService);

    await assert.rejects(repository.createMovement('product-1', { type: 'IN', quantity: 3 }), /Movement insert failed/);
    assert.deepEqual(database.transactionOutcome, ['BEGIN', 'ROLLBACK']);
    assert.equal(database.quantity, 8, 'The stock update must be rolled back with a failed movement insert.');
    assert.ok(database.statements.some((statement) => statement.includes('UPDATE bazariya.inventory')));
  });

  it('rejects inactive products before issuing inventory or movement writes', async () => {
    const database = new ScriptedDatabase();
    database.productIsActive = false;
    const repository = new InventoryRepository(database as unknown as DatabaseService);

    await assert.rejects(repository.createMovement('product-1', { type: 'IN', quantity: 3 }), (error: unknown) =>
      error instanceof InventoryDomainError && error.code === 'PRODUCT_NOT_AVAILABLE');
    assert.deepEqual(database.transactionOutcome, ['BEGIN', 'ROLLBACK']);
    assert.equal(database.statements.some((statement) => statement.includes('UPDATE bazariya.inventory')), false);
    assert.equal(database.statements.some((statement) => statement.includes('INSERT INTO bazariya.stock_movements')), false);
  });
});

describe('Inventory API', () => {
  let app: INestApplication;
  let inventory: MemoryInventoryRepository;

  before(async () => {
    inventory = new MemoryInventoryRepository();
    const pool = {
      query: async () => ({ rows: [], rowCount: 0 }),
      connect: async () => { throw new Error('Inventory API test must not connect to a database.'); },
      end: async () => undefined,
    };
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PG_POOL)
      .useValue(pool)
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

  beforeEach(() => inventory.reset());

  it('searches Products, filters separate low/out-of-stock statuses, paginates, and reads inactive products', async () => {
    const tea = makeInventory({ quantity: 3, minimumQuantity: 5 });
    const empty = makeInventory({
      quantity: 0,
      minimumQuantity: 0,
      productOverrides: { name: 'ظرف نمونه', sku: 'BOX-001' },
    });
    const inactive = makeInventory({
      productOverrides: { name: 'قوری نمونه', sku: 'POT-001', isActive: false },
    });
    inventory.add(tea);
    inventory.add(empty);
    inventory.add(inactive);

    const searched = await request(app.getHttpServer())
      .get('/api/v1/inventory')
      .query({ search: 'tea', page: 1, pageSize: 1 })
      .expect(200);
    assert.equal(searched.body.data.items[0].product.id, tea.product.id);
    assert.deepEqual(searched.body.data.pagination, { page: 1, pageSize: 1, total: 1, totalPages: 1 });

    const low = await request(app.getHttpServer()).get('/api/v1/inventory?status=low-stock').expect(200);
    assert.deepEqual(low.body.data.items.map((item: InventoryItem) => item.product.id), [tea.product.id]);
    const out = await request(app.getHttpServer()).get('/api/v1/inventory?status=out-of-stock').expect(200);
    assert.deepEqual(out.body.data.items.map((item: InventoryItem) => item.product.id), [empty.product.id]);
    const inclusiveLow = await request(app.getHttpServer()).get('/api/v1/inventory?lowStock=true').expect(200);
    assert.deepEqual(new Set(inclusiveLow.body.data.items.map((item: InventoryItem) => item.product.id)), new Set([tea.product.id, empty.product.id]));

    const inactiveRead = await request(app.getHttpServer()).get(`/api/v1/inventory/${inactive.product.id}`).expect(200);
    assert.equal(inactiveRead.body.data.product.isActive, false);
    const missing = await request(app.getHttpServer()).get(`/api/v1/inventory/${randomUUID()}`).expect(404);
    assert.equal(missing.body.error.code, 'PRODUCT_NOT_FOUND');
    const invalidFilter = await request(app.getHttpServer()).get('/api/v1/inventory?status=unknown').expect(400);
    assert.equal(invalidFilter.body.error.code, 'VALIDATION_ERROR');
  });

  it('records backend snapshots for IN, OUT, and target-quantity ADJUSTMENT movements', async () => {
    const item = makeInventory({ quantity: 10, minimumQuantity: 4 });
    inventory.add(item);

    const inbound = await request(app.getHttpServer())
      .post(`/api/v1/inventory/${item.product.id}/movements`)
      .send({ type: 'IN', quantity: 3, note: '  رسید کالا  ' })
      .expect(201);
    assert.deepEqual(inbound.body.data.movement, {
      id: inbound.body.data.movement.id,
      productId: item.product.id,
      type: 'IN',
      quantity: 3,
      beforeQuantity: 10,
      afterQuantity: 13,
      note: 'رسید کالا',
      createdAt: inbound.body.data.movement.createdAt,
    });
    assert.equal(inbound.body.data.inventory.quantity, 13);

    const outbound = await request(app.getHttpServer())
      .post(`/api/v1/inventory/${item.product.id}/movements`)
      .send({ type: 'OUT', quantity: 2 })
      .expect(201);
    assert.equal(outbound.body.data.movement.beforeQuantity, 13);
    assert.equal(outbound.body.data.movement.afterQuantity, 11);
    assert.equal(outbound.body.data.movement.quantity, 2);

    const adjustment = await request(app.getHttpServer())
      .post(`/api/v1/inventory/${item.product.id}/movements`)
      .send({ type: 'ADJUSTMENT', quantity: 4 })
      .expect(201);
    assert.equal(adjustment.body.data.movement.beforeQuantity, 11);
    assert.equal(adjustment.body.data.movement.afterQuantity, 4);
    assert.equal(adjustment.body.data.movement.quantity, 7);

    const history = await request(app.getHttpServer())
      .get(`/api/v1/inventory/${item.product.id}/movements`)
      .query({ type: 'ADJUSTMENT', page: 1, pageSize: 1 })
      .expect(200);
    assert.equal(history.body.data.items.length, 1);
    assert.equal(history.body.data.items[0].afterQuantity, 4);
    assert.deepEqual(history.body.data.pagination, { page: 1, pageSize: 1, total: 1, totalPages: 1 });

    const beforeMinimumUpdate = inventory.allMovements(item.product.id).length;
    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/inventory/${item.product.id}/minimum`)
      .send({ minimumQuantity: 6 })
      .expect(200);
    assert.equal(updated.body.data.minimumQuantity, 6);
    assert.equal(updated.body.data.isLowStock, true);
    assert.equal(inventory.allMovements(item.product.id).length, beforeMinimumUpdate);
  });

  it('rejects invalid amounts, unsafe payload fields, overselling, and movements on inactive products', async () => {
    const item = makeInventory({ quantity: 5, minimumQuantity: 2 });
    const inactive = makeInventory({ productOverrides: { isActive: false } });
    inventory.add(item);
    inventory.add(inactive);

    const insufficient = await request(app.getHttpServer())
      .post(`/api/v1/inventory/${item.product.id}/movements`)
      .send({ type: 'OUT', quantity: 6 })
      .expect(409);
    assert.equal(insufficient.body.error.code, 'INSUFFICIENT_STOCK');
    assert.equal((await inventory.findByProductId(item.product.id))?.quantity, 5);
    assert.equal(inventory.allMovements(item.product.id).length, 0);

    for (const body of [
      { type: 'IN', quantity: 0 },
      { type: 'OUT', quantity: 0 },
      { type: 'IN', quantity: 1.25 },
      { type: 'ADJUSTMENT', quantity: -1 },
      { type: 'IN', quantity: Number.MAX_SAFE_INTEGER + 1 },
    ]) {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/inventory/${item.product.id}/movements`)
        .send(body)
        .expect(400);
      assert.equal(response.body.error.code, 'INVALID_QUANTITY');
    }

    const invalidType = await request(app.getHttpServer())
      .post(`/api/v1/inventory/${item.product.id}/movements`)
      .send({ type: 'RETURN', quantity: 1 })
      .expect(400);
    assert.equal(invalidType.body.error.code, 'INVALID_MOVEMENT_TYPE');

    const forged = await request(app.getHttpServer())
      .post(`/api/v1/inventory/${item.product.id}/movements`)
      .send({ type: 'IN', quantity: 1, beforeQuantity: 500, afterQuantity: 501 })
      .expect(400);
    assert.equal(forged.body.error.code, 'VALIDATION_ERROR');

    const invalidMinimum = await request(app.getHttpServer())
      .patch(`/api/v1/inventory/${item.product.id}/minimum`)
      .send({ minimumQuantity: 1.5 })
      .expect(400);
    assert.equal(invalidMinimum.body.error.code, 'INVALID_MINIMUM_QUANTITY');
    const unknownMinimumField = await request(app.getHttpServer())
      .patch(`/api/v1/inventory/${item.product.id}/minimum`)
      .send({ minimumQuantity: 1, quantity: 100 })
      .expect(400);
    assert.equal(unknownMinimumField.body.error.code, 'VALIDATION_ERROR');

    const blocked = await request(app.getHttpServer())
      .post(`/api/v1/inventory/${inactive.product.id}/movements`)
      .send({ type: 'IN', quantity: 3 })
      .expect(409);
    assert.equal(blocked.body.error.code, 'PRODUCT_NOT_AVAILABLE');
    assert.equal(inventory.allMovements(inactive.product.id).length, 0);
  });

  it('serializes concurrent OUT requests so only available stock is consumed', async () => {
    const item = makeInventory({ quantity: 10, minimumQuantity: 0 });
    inventory.add(item);
    const results = await Promise.all([
      request(app.getHttpServer()).post(`/api/v1/inventory/${item.product.id}/movements`).send({ type: 'OUT', quantity: 6 }),
      request(app.getHttpServer()).post(`/api/v1/inventory/${item.product.id}/movements`).send({ type: 'OUT', quantity: 6 }),
    ]);

    assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
    assert.equal((await inventory.findByProductId(item.product.id))?.quantity, 4);
    assert.equal(inventory.allMovements(item.product.id).length, 1);
  });

  it('validates history time ranges and returns paginated movement history', async () => {
    const item = makeInventory({ quantity: 0, minimumQuantity: 0 });
    inventory.add(item);
    await request(app.getHttpServer())
      .post(`/api/v1/inventory/${item.product.id}/movements`)
      .send({ type: 'IN', quantity: 2 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/inventory/${item.product.id}/movements`)
      .send({ type: 'OUT', quantity: 1 })
      .expect(201);

    const page = await request(app.getHttpServer())
      .get(`/api/v1/inventory/${item.product.id}/movements`)
      .query({ page: 1, pageSize: 1, from: '2026-10-03T00:00:00Z', to: '2026-10-05T00:00:00Z' })
      .expect(200);
    assert.equal(page.body.data.items.length, 1);
    assert.deepEqual(page.body.data.pagination, { page: 1, pageSize: 1, total: 2, totalPages: 2 });

    const reversed = await request(app.getHttpServer())
      .get(`/api/v1/inventory/${item.product.id}/movements`)
      .query({ from: '2026-10-05T00:00:00Z', to: '2026-10-03T00:00:00Z' })
      .expect(400);
    assert.equal(reversed.body.error.code, 'INVALID_DATE_RANGE');
    const noTimezone = await request(app.getHttpServer())
      .get(`/api/v1/inventory/${item.product.id}/movements?from=2026-10-03T00:00:00`)
      .expect(400);
    assert.equal(noTimezone.body.error.code, 'VALIDATION_ERROR');
  });
});
