import { HttpStatus, Injectable } from '@nestjs/common';
import {
  STOCK_MOVEMENT_TYPES,
  type CreateStockMovementInput,
  type CreateStockMovementResult,
  type InventoryItem,
  type InventoryListQuery,
  type PaginatedData,
  type StockMovement,
  type StockMovementListQuery,
  type UpdateInventoryMinimumInput,
} from '@bazariya/shared';
import type { PoolClient } from 'pg';
import { ApiException } from '../common/errors/api.exception.js';
import { InventoryDomainError } from './inventory.errors.js';
import { InventoryRepository } from './inventory.repository.js';

@Injectable()
export class InventoryService {
  constructor(private readonly inventory: InventoryRepository) {}

  list(query: InventoryListQuery): Promise<PaginatedData<InventoryItem>> {
    return this.run(() => this.inventory.list(query));
  }

  async get(productId: string): Promise<InventoryItem> {
    return this.run(async () => {
      const item = await this.inventory.findByProductId(productId);
      if (!item) throw new InventoryDomainError('PRODUCT_NOT_FOUND', 'محصول موردنظر پیدا نشد.', 404);
      return item;
    });
  }

  async updateMinimum(productId: string, input: UpdateInventoryMinimumInput): Promise<InventoryItem> {
    const minimumQuantity = this.validateMinimum(input);
    return this.run(() => this.inventory.updateMinimum(productId, minimumQuantity));
  }

  async createMovement(productId: string, input: CreateStockMovementInput): Promise<CreateStockMovementResult> {
    const normalized = this.validateMovement(input);
    return this.run(() => this.inventory.createMovement(productId, normalized));
  }

  async createMovementInTransaction(
    client: PoolClient,
    productId: string,
    input: CreateStockMovementInput,
  ): Promise<CreateStockMovementResult> {
    const normalized = this.validateMovement(input);
    return this.run(() => this.inventory.createMovementInTransaction(client, productId, normalized));
  }

  async assertProductsAvailableInTransaction(client: PoolClient, productIds: readonly string[]): Promise<void> {
    return this.run(() => this.inventory.assertProductsAvailableInTransaction(client, productIds));
  }

  async listMovements(
    productId: string,
    query: StockMovementListQuery,
  ): Promise<PaginatedData<StockMovement>> {
    this.validateDateRange(query);
    return this.run(async () => {
      const item = await this.inventory.findByProductId(productId);
      if (!item) throw new InventoryDomainError('PRODUCT_NOT_FOUND', 'محصول موردنظر پیدا نشد.', 404);
      return this.inventory.listMovements(productId, query);
    });
  }

  private validateMinimum(input: UpdateInventoryMinimumInput): number {
    const candidate = this.asRecord(input);
    if (!candidate) {
      throw this.domainException(
        new InventoryDomainError('INVALID_MINIMUM_QUANTITY', 'حداقل موجودی معتبر نیست.', HttpStatus.BAD_REQUEST),
      );
    }
    const minimumQuantity = candidate.minimumQuantity;
    if (!Number.isSafeInteger(minimumQuantity) || typeof minimumQuantity !== 'number' || minimumQuantity < 0) {
      throw this.domainException(
        new InventoryDomainError(
          'INVALID_MINIMUM_QUANTITY',
          'حداقل موجودی باید یک عدد صحیح نامنفی و در محدودهٔ مجاز باشد.',
          HttpStatus.BAD_REQUEST,
          [{ field: 'minimumQuantity', message: 'مقدار حداقل موجودی را به‌صورت عدد صحیح صفر یا بیشتر وارد کنید.' }],
        ),
      );
    }
    return minimumQuantity;
  }

  private validateMovement(input: CreateStockMovementInput): CreateStockMovementInput {
    const candidate = this.asRecord(input);
    if (!candidate) {
      throw this.domainException(
        new InventoryDomainError('INVALID_MOVEMENT_TYPE', 'نوع گردش موجودی معتبر نیست.', HttpStatus.BAD_REQUEST),
      );
    }
    const type = candidate.type;
    if (typeof type !== 'string' || !STOCK_MOVEMENT_TYPES.includes(type as (typeof STOCK_MOVEMENT_TYPES)[number])) {
      throw this.domainException(
        new InventoryDomainError('INVALID_MOVEMENT_TYPE', 'نوع گردش موجودی معتبر نیست.', HttpStatus.BAD_REQUEST),
      );
    }

    const quantity = candidate.quantity;
    if (
      typeof quantity !== 'number'
      || !Number.isSafeInteger(quantity)
      || quantity < 0
      || ((type === 'IN' || type === 'OUT') && quantity === 0)
    ) {
      throw this.domainException(
        new InventoryDomainError(
          'INVALID_QUANTITY',
          'تعداد باید یک عدد صحیح نامنفی و در محدودهٔ مجاز باشد؛ ورود و خروج باید بیشتر از صفر باشند.',
          HttpStatus.BAD_REQUEST,
          [{ field: 'quantity', message: 'برای ورود و خروج عددی صحیح و مثبت وارد کنید؛ برای اصلاح موجودی عدد نهایی صفر یا بیشتر را وارد کنید.' }],
        ),
      );
    }

    const note = candidate.note;
    if (note !== undefined && note !== null && typeof note !== 'string') {
      throw this.domainException(
        new InventoryDomainError('INVALID_MOVEMENT_NOTE', 'یادداشت گردش موجودی معتبر نیست.', HttpStatus.BAD_REQUEST),
      );
    }
    const normalizedNote = typeof note === 'string' ? note.trim() : null;
    if (normalizedNote && normalizedNote.length > 500) {
      throw this.domainException(
        new InventoryDomainError(
          'INVALID_MOVEMENT_NOTE',
          'یادداشت نمی‌تواند بیشتر از ۵۰۰ نویسه باشد.',
          HttpStatus.BAD_REQUEST,
          [{ field: 'note', message: 'یادداشت را کوتاه‌تر کنید.' }],
        ),
      );
    }

    return {
      type: type as CreateStockMovementInput['type'],
      quantity,
      note: normalizedNote || null,
    };
  }

  private validateDateRange(query: StockMovementListQuery): void {
    if (query.from && query.to && Date.parse(query.from) > Date.parse(query.to)) {
      throw this.domainException(
        new InventoryDomainError(
          'INVALID_DATE_RANGE',
          'بازهٔ زمانی گردش موجودی معتبر نیست.',
          HttpStatus.BAD_REQUEST,
          [{ field: 'from', message: 'زمان آغاز باید پیش از زمان پایان باشد.' }],
        ),
      );
    }
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null;
  }

  private async run<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof InventoryDomainError) throw this.domainException(error);
      throw error;
    }
  }

  private domainException(error: InventoryDomainError): ApiException {
    return new ApiException(error.status, error.code, error.message, error.details);
  }
}
