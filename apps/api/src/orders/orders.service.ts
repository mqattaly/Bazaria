import { HttpStatus, Injectable } from '@nestjs/common';
import type {
  CreateOrderInput,
  OrderDetails,
  OrderListItem,
  OrderListQuery,
  PaginatedData,
  UpdateOrderInput,
} from '@bazariya/shared';
import { ApiException } from '../common/errors/api.exception.js';
import { OrderDomainError } from './orders.errors.js';
import { OrdersRepository } from './orders.repository.js';

@Injectable()
export class OrdersService {
  constructor(private readonly orders: OrdersRepository) {}

  async list(query: OrderListQuery): Promise<PaginatedData<OrderListItem>> {
    const from = query.from === undefined ? undefined : Date.parse(query.from);
    const to = query.to === undefined ? undefined : Date.parse(query.to);
    if ((from !== undefined && !Number.isFinite(from)) || (to !== undefined && !Number.isFinite(to))) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'ORDER_DATE_RANGE_INVALID', 'بازهٔ زمانی سفارش معتبر نیست.');
    }
    if (from !== undefined && to !== undefined && from > to) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'ORDER_DATE_RANGE_INVALID', 'بازهٔ زمانی سفارش معتبر نیست.', [
        { field: 'to', message: 'زمان پایان باید برابر یا پس از زمان آغاز باشد.' },
      ]);
    }
    return this.run(() => this.orders.list(query));
  }

  async get(id: string): Promise<OrderDetails> {
    const order = await this.run(() => this.orders.findById(id));
    if (!order) throw this.notFound();
    return order;
  }

  create(input: CreateOrderInput): Promise<OrderDetails> {
    return this.run(() => this.orders.create(input));
  }

  async update(id: string, input: UpdateOrderInput): Promise<OrderDetails> {
    if (!Object.values(input).some((value) => value !== undefined)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'ORDER_INVALID', 'برای ویرایش سفارش دست‌کم یک فیلد لازم است.');
    }
    const order = await this.run(() => this.orders.update(id, input));
    if (!order) throw this.notFound();
    return order;
  }

  async updateStatus(id: string, status: 'confirmed' | 'cancelled'): Promise<OrderDetails> {
    const order = await this.run(() => this.orders.updateStatus(id, status));
    if (!order) throw this.notFound();
    return order;
  }

  private async run<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof OrderDomainError) {
        throw new ApiException(error.status, error.code, error.message, error.details);
      }
      throw error;
    }
  }

  private notFound(): ApiException {
    return new ApiException(HttpStatus.NOT_FOUND, 'ORDER_NOT_FOUND', 'سفارش موردنظر پیدا نشد.');
  }
}
