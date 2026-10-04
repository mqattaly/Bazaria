import { Injectable } from '@nestjs/common';
import type {
  CreateOrderInput,
  Order,
  OrderCustomerSummary,
  OrderDetails,
  OrderItem,
  OrderItemInput,
  OrderListItem,
  OrderListQuery,
  OrderStatus,
  PaginatedData,
  ProductUnit,
  UpdateOrderInput,
} from '@bazariya/shared';
import { PRODUCT_UNITS } from '@bazariya/shared';
import type { PoolClient, QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service.js';
import { calculateOrderTotals, mergeDuplicateItems } from './orders.calculations.js';
import { OrderDomainError } from './orders.errors.js';

interface OrderRow extends QueryResultRow {
  id: string;
  orderNumber: string;
  customerId: string | null;
  status: string;
  note: string | null;
  subtotal: string | number;
  discount: string | number;
  total: string | number;
  createdAt: Date | string;
  updatedAt: Date | string;
  confirmedAt: Date | string | null;
  cancelledAt: Date | string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  itemCount?: string | number;
}

interface OrderEditRow extends QueryResultRow {
  id: string;
  customerId: string | null;
  status: string;
  note: string | null;
  subtotal: string | number;
  discount: string | number;
}

interface JoinedOrderRow extends OrderRow {
  customerName: string | null;
  customerPhone: string | null;
  itemId: string | null;
  productId: string | null;
  productName: string | null;
  sku: string | null;
  unit: string | null;
  quantity: number | null;
  unitPrice: string | number | null;
  lineTotal: string | number | null;
}

interface ProductSnapshotRow extends QueryResultRow {
  id: string;
  name: string;
  sku: string;
  unit: string;
  salePrice: string | number;
  isActive: boolean;
}

interface CustomerAvailabilityRow extends QueryResultRow {
  id: string;
  isActive: boolean;
}

interface CountRow extends QueryResultRow {
  total: string | number;
}

interface SequenceRow extends QueryResultRow {
  value: string;
}

const orderColumns = `
  o.id,
  o.order_number AS "orderNumber",
  o.customer_id AS "customerId",
  o.status,
  o.note,
  o.subtotal,
  o.discount,
  o.total,
  o.created_at AS "createdAt",
  o.updated_at AS "updatedAt",
  o.confirmed_at AS "confirmedAt",
  o.cancelled_at AS "cancelledAt"
`;

const unitValues = new Set<string>(PRODUCT_UNITS);

function toIsoString(value: Date | string | null): string | null {
  if (value === null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Stored order timestamp is invalid.');
  return date.toISOString();
}

function toSafeInteger(value: string | number, field: string, min = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min) {
    throw new Error(`Stored ${field} is not a safe integer.`);
  }
  return parsed;
}

function mapOrder(row: OrderRow): Order {
  if (row.status !== 'draft' && row.status !== 'confirmed' && row.status !== 'cancelled') {
    throw new Error('Stored order status is invalid.');
  }

  return {
    id: row.id,
    orderNumber: row.orderNumber,
    customerId: row.customerId,
    status: row.status as OrderStatus,
    note: row.note,
    subtotal: toSafeInteger(row.subtotal, 'order subtotal'),
    discount: toSafeInteger(row.discount, 'order discount'),
    total: toSafeInteger(row.total, 'order total'),
    createdAt: toIsoString(row.createdAt)!,
    updatedAt: toIsoString(row.updatedAt)!,
    confirmedAt: toIsoString(row.confirmedAt),
    cancelledAt: toIsoString(row.cancelledAt),
  };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

function normalizeNote(note: string | null | undefined): string | null {
  if (note === undefined || note === null) return null;
  const trimmed = note.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asOrderItem(row: JoinedOrderRow): OrderItem {
  if (
    row.itemId === null
    || row.productId === null
    || row.productName === null
    || row.sku === null
    || row.unit === null
    || row.quantity === null
    || row.unitPrice === null
    || row.lineTotal === null
  ) {
    throw new Error('Order item row is incomplete.');
  }
  if (!unitValues.has(row.unit)) throw new Error('Stored order item unit is invalid.');

  return {
    id: row.itemId,
    orderId: row.id,
    productId: row.productId,
    productName: row.productName,
    sku: row.sku,
    unit: row.unit as ProductUnit,
    quantity: toSafeInteger(row.quantity, 'order item quantity', 1),
    unitPrice: toSafeInteger(row.unitPrice, 'order item unit price'),
    total: toSafeInteger(row.lineTotal, 'order item total'),
  };
}

function mapOrderDetails(rows: JoinedOrderRow[]): OrderDetails | null {
  const first = rows[0];
  if (!first) return null;
  const order = mapOrder(first);
  const customer: OrderCustomerSummary | null = first.customerId && first.customerName !== null
    ? { id: first.customerId, name: first.customerName, phone: first.customerPhone ?? null }
    : null;
  const items = rows.filter((row) => row.itemId !== null).map(asOrderItem);
  return { ...order, customer, items };
}

function buildListConditions(query: OrderListQuery): { conditions: string[]; values: unknown[] } {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (query.search) {
    values.push(`%${escapeLike(query.search)}%`);
    const parameter = values.length;
    conditions.push(`(
      o.order_number ILIKE $${parameter} ESCAPE E'\\\\'
      OR c.name ILIKE $${parameter} ESCAPE E'\\\\'
      OR COALESCE(c.phone, '') ILIKE $${parameter} ESCAPE E'\\\\'
      OR EXISTS (
        SELECT 1 FROM bazariya.order_items search_item
        WHERE search_item.order_id = o.id
          AND (search_item.product_name ILIKE $${parameter} ESCAPE E'\\\\'
            OR search_item.sku ILIKE $${parameter} ESCAPE E'\\\\')
      )
    )`);
  }
  if (query.customerId) {
    values.push(query.customerId);
    conditions.push(`o.customer_id = $${values.length}`);
  }
  if (query.status) {
    values.push(query.status);
    conditions.push(`o.status = $${values.length}`);
  }
  if (query.from) {
    values.push(new Date(query.from).toISOString());
    conditions.push(`o.created_at >= $${values.length}::timestamptz`);
  }
  if (query.to) {
    values.push(new Date(query.to).toISOString());
    conditions.push(`o.created_at <= $${values.length}::timestamptz`);
  }

  return { conditions, values };
}

@Injectable()
export class OrdersRepository {
  constructor(private readonly database: DatabaseService) {}

  async list(query: OrderListQuery): Promise<PaginatedData<OrderListItem>> {
    const { conditions, values } = buildListConditions(query);
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await this.database.query<CountRow>(
      `SELECT count(*)::bigint AS total
       FROM bazariya.orders o
       LEFT JOIN bazariya.customers c ON c.id = o.customer_id
       ${where}`,
      values,
    );
    const total = toSafeInteger(countResult.rows[0]?.total ?? 0, 'order count');

    const offset = (query.page - 1) * query.pageSize;
    const limitParameter = values.length + 1;
    const offsetParameter = values.length + 2;
    const result = await this.database.query<OrderRow>(
      `SELECT ${orderColumns},
              c.name AS "customerName",
              c.phone AS "customerPhone",
              item_counts.item_count AS "itemCount"
       FROM bazariya.orders o
       LEFT JOIN bazariya.customers c ON c.id = o.customer_id
       LEFT JOIN LATERAL (
         SELECT count(*)::bigint AS item_count
         FROM bazariya.order_items item_count
         WHERE item_count.order_id = o.id
       ) item_counts ON true
       ${where}
       ORDER BY o.created_at DESC, o.id DESC
       LIMIT $${limitParameter} OFFSET $${offsetParameter}`,
      [...values, query.pageSize, offset],
    );

    return {
      items: result.rows.map((row) => ({
        ...mapOrder(row),
        customerName: row.customerName ?? null,
        customerPhone: row.customerPhone ?? null,
        itemCount: toSafeInteger(row.itemCount ?? 0, 'order item count'),
      })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async findById(id: string): Promise<OrderDetails | null> {
    const result = await this.database.query<JoinedOrderRow>(this.detailsQuery, [id]);
    return mapOrderDetails(result.rows);
  }

  async create(input: CreateOrderInput): Promise<OrderDetails> {
    return this.database.transaction(async (client) => {
      const items = mergeDuplicateItems(input.items);
      const products = await this.getActiveProducts(client, items);
      const customerId = input.customerId ?? null;
      if (customerId) await this.requireActiveCustomer(client, customerId);
      const lines = items.map((item) => ({
        product: products.get(item.productId)!,
        quantity: item.quantity,
      }));
      const totals = calculateOrderTotals(
        lines.map(({ product, quantity }) => ({ quantity, unitPrice: product.salePrice })),
        input.discount ?? 0,
      );

      const sequence = await client.query<SequenceRow>(
        "SELECT nextval('bazariya.order_number_seq')::text AS value",
      );
      const sequenceValue = sequence.rows[0]?.value;
      if (!sequenceValue || !/^\d{1,19}$/.test(sequenceValue)) throw new Error('Order number sequence is invalid.');
      const orderNumber = `BAZ-${sequenceValue.padStart(9, '0')}`;
      const created = await client.query<OrderRow>(
        `INSERT INTO bazariya.orders (order_number, customer_id, note)
         VALUES ($1, $2, $3)
         RETURNING
           id,
           order_number AS "orderNumber",
           customer_id AS "customerId",
           status,
           note,
           subtotal,
           discount,
           total,
           created_at AS "createdAt",
           updated_at AS "updatedAt",
           confirmed_at AS "confirmedAt",
           cancelled_at AS "cancelledAt"`,
        [orderNumber, customerId, normalizeNote(input.note)],
      );
      const orderId = created.rows[0]?.id;
      if (!orderId) throw new Error('Order insert did not return an id.');

      await this.insertItems(client, orderId, lines, totals.itemTotals);
      await client.query(
        `UPDATE bazariya.orders
         SET subtotal = $2, discount = $3, total = $4
         WHERE id = $1`,
        [orderId, totals.subtotal, totals.discount, totals.total],
      );
      return this.getDetailsWithClient(client, orderId);
    });
  }

  async update(id: string, input: UpdateOrderInput): Promise<OrderDetails | null> {
    return this.database.transaction(async (client) => {
      const orderResult = await client.query<OrderEditRow>(
        `SELECT id,
                customer_id AS "customerId",
                status,
                note,
                subtotal,
                discount
         FROM bazariya.orders
         WHERE id = $1
         FOR UPDATE`,
        [id],
      );
      const order = orderResult.rows[0];
      if (!order) return null;
      if (order.status !== 'draft') {
        throw new OrderDomainError('ORDER_NOT_EDITABLE', 'فقط سفارش پیش‌نویس قابل ویرایش است.', 409);
      }

      const currentSubtotal = toSafeInteger(order.subtotal, 'order subtotal');
      const currentDiscount = toSafeInteger(order.discount, 'order discount');
      const currentItems = await this.getStoredItems(client, id);
      let nextItems: Array<{ product: ProductSnapshot; quantity: number }>;
      if (input.items !== undefined) {
        const mergedItems = mergeDuplicateItems(input.items);
        const products = await this.getActiveProducts(client, mergedItems);
        nextItems = mergedItems.map((item) => ({ product: products.get(item.productId)!, quantity: item.quantity }));
      } else {
        nextItems = currentItems.map((item) => ({ product: item.product, quantity: item.quantity }));
      }

      const discount = input.discount ?? currentDiscount;
      const totals = calculateOrderTotals(
        nextItems.map(({ product, quantity }) => ({ quantity, unitPrice: product.salePrice })),
        discount,
      );
      if (input.items === undefined && totals.subtotal !== currentSubtotal) {
        throw new Error('Stored order item totals do not match the order subtotal.');
      }

      const customerId = input.customerId !== undefined ? input.customerId : order.customerId;
      if (input.customerId && input.customerId !== order.customerId) {
        await this.requireActiveCustomer(client, input.customerId);
      }

      if (input.items !== undefined) {
        await client.query('DELETE FROM bazariya.order_items WHERE order_id = $1', [id]);
        await this.insertItems(client, id, nextItems, totals.itemTotals);
      }

      const updateValues: unknown[] = [
        id,
        input.note !== undefined ? normalizeNote(input.note) : order.note,
        totals.subtotal,
        totals.discount,
        totals.total,
      ];
      const updates = [
        'note = $2',
        'subtotal = $3',
        'discount = $4',
        'total = $5',
      ];
      if (customerId !== order.customerId) {
        updateValues.push(customerId);
        updates.unshift(`customer_id = $${updateValues.length}`);
      }
      await client.query(
        `UPDATE bazariya.orders SET ${updates.join(', ')} WHERE id = $1`,
        updateValues,
      );
      return this.getDetailsWithClient(client, id);
    });
  }

  async updateStatus(id: string, status: 'confirmed' | 'cancelled'): Promise<OrderDetails | null> {
    return this.database.transaction(async (client) => {
      const result = await client.query<{ id: string; status: string } & QueryResultRow>(
        `SELECT id, status FROM bazariya.orders WHERE id = $1 FOR UPDATE`,
        [id],
      );
      const order = result.rows[0];
      if (!order) return null;
      if (order.status === status) return this.getDetailsWithClient(client, id);
      const allowed =
        (order.status === 'draft' && (status === 'confirmed' || status === 'cancelled'))
        || (order.status === 'confirmed' && status === 'cancelled');
      if (!allowed) {
        throw new OrderDomainError(
          'ORDER_INVALID_STATUS_TRANSITION',
          'تغییر وضعیت این سفارش مجاز نیست.',
          409,
        );
      }

      await client.query('UPDATE bazariya.orders SET status = $2 WHERE id = $1', [id, status]);
      return this.getDetailsWithClient(client, id);
    });
  }

  private get detailsQuery(): string {
    return `SELECT ${orderColumns},
                   c.name AS "customerName",
                   c.phone AS "customerPhone",
                   oi.id AS "itemId",
                   oi.product_id AS "productId",
                   oi.product_name AS "productName",
                   oi.sku,
                   oi.unit,
                   oi.quantity,
                   oi.unit_price AS "unitPrice",
                   oi.line_total AS "lineTotal"
            FROM bazariya.orders o
            LEFT JOIN bazariya.customers c ON c.id = o.customer_id
            LEFT JOIN bazariya.order_items oi ON oi.order_id = o.id
            WHERE o.id = $1
            ORDER BY oi.id`;
  }

  private async getDetailsWithClient(client: PoolClient, id: string): Promise<OrderDetails> {
    const result = await client.query<JoinedOrderRow>(this.detailsQuery, [id]);
    const details = mapOrderDetails(result.rows);
    if (!details) throw new Error('Order details were not returned.');
    return details;
  }

  private async getActiveProducts(
    client: PoolClient,
    items: readonly OrderItemInput[],
  ): Promise<Map<string, ProductSnapshot>> {
    const productIds = items.map((item) => item.productId);
    const result = await client.query<ProductSnapshotRow>(
      `SELECT id,
              name,
              sku,
              unit,
              sale_price AS "salePrice",
              is_active AS "isActive"
       FROM bazariya.products
       WHERE id = ANY($1::uuid[])
       ORDER BY id
       FOR SHARE`,
      [productIds],
    );
    const products = new Map<string, ProductSnapshot>();
    for (const row of result.rows) {
      if (!row.isActive) {
        throw new OrderDomainError('PRODUCT_NOT_AVAILABLE', 'یکی از محصولات سفارش غیرفعال است.', 400, [
          { field: 'items', message: `محصول «${row.name}» در حال حاضر فعال نیست.` },
        ]);
      }
      if (!unitValues.has(row.unit)) throw new Error('Stored product unit is invalid.');
      products.set(row.id, {
        id: row.id,
        name: row.name,
        sku: row.sku,
        unit: row.unit as ProductUnit,
        salePrice: toSafeInteger(row.salePrice, 'product sale price'),
      });
    }

    const missing = productIds.find((id) => !products.has(id));
    if (missing) {
      throw new OrderDomainError('PRODUCT_NOT_FOUND', 'یکی از محصولات سفارش پیدا نشد.', 404, [
        { field: 'items', message: 'همهٔ محصولات انتخاب‌شده باید وجود داشته باشند.' },
      ]);
    }
    return products;
  }

  private async requireActiveCustomer(client: PoolClient, customerId: string): Promise<void> {
    const result = await client.query<CustomerAvailabilityRow>(
      `SELECT id, is_active AS "isActive"
       FROM bazariya.customers
       WHERE id = $1
       FOR SHARE`,
      [customerId],
    );
    const customer = result.rows[0];
    if (!customer) {
      throw new OrderDomainError('CUSTOMER_NOT_FOUND', 'مشتری انتخاب‌شده پیدا نشد.', 404, [
        { field: 'customerId', message: 'مشتری انتخاب‌شده وجود ندارد.' },
      ]);
    }
    if (!customer.isActive) {
      throw new OrderDomainError('CUSTOMER_NOT_AVAILABLE', 'مشتری انتخاب‌شده غیرفعال است.', 400, [
        { field: 'customerId', message: 'برای سفارش فقط می‌توان مشتری فعال انتخاب کرد.' },
      ]);
    }
  }

  private async insertItems(
    client: PoolClient,
    orderId: string,
    items: readonly { product: ProductSnapshot; quantity: number }[],
    totals: readonly number[],
  ): Promise<void> {
    if (items.length !== totals.length) throw new Error('Order item totals do not match item count.');
    for (const [index, item] of items.entries()) {
      const lineTotal = totals[index]!;
      await client.query(
        `INSERT INTO bazariya.order_items (
           order_id, product_id, product_name, sku, unit, quantity, unit_price, line_total
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          orderId,
          item.product.id,
          item.product.name,
          item.product.sku,
          item.product.unit,
          item.quantity,
          item.product.salePrice,
          lineTotal,
        ],
      );
    }
  }

  private async getStoredItems(
    client: PoolClient,
    orderId: string,
  ): Promise<Array<{ product: ProductSnapshot; quantity: number; lineTotal: number }>> {
    const result = await client.query<{
      productId: string;
      productName: string;
      sku: string;
      unit: string;
      quantity: number;
      unitPrice: string | number;
      lineTotal: string | number;
    } & QueryResultRow>(
      `SELECT product_id AS "productId",
              product_name AS "productName",
              sku,
              unit,
              quantity,
              unit_price AS "unitPrice",
              line_total AS "lineTotal"
       FROM bazariya.order_items
       WHERE order_id = $1
       ORDER BY id`,
      [orderId],
    );

    return result.rows.map((row) => {
      if (!unitValues.has(row.unit)) throw new Error('Stored order item unit is invalid.');
      return {
        product: {
          id: row.productId,
          name: row.productName,
          sku: row.sku,
          unit: row.unit as ProductUnit,
          salePrice: toSafeInteger(row.unitPrice, 'order item unit price'),
        },
        quantity: toSafeInteger(row.quantity, 'order item quantity', 1),
        lineTotal: toSafeInteger(row.lineTotal, 'order item total'),
      };
    });
  }
}

interface ProductSnapshot {
  id: string;
  name: string;
  sku: string;
  unit: ProductUnit;
  salePrice: number;
}
