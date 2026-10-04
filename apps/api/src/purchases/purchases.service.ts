import { HttpStatus, Injectable } from '@nestjs/common';
import type {
  CreatePurchaseInput,
  PaginatedData,
  PurchaseDetails,
  PurchaseListItem,
  PurchaseListQuery,
  PurchaseStatus,
  PurchaseItemInput,
  UpdatePurchaseInput,
} from '@bazariya/shared';
import { ApiException } from '../common/errors/api.exception.js';
import { DatabaseService } from '../database/database.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { SuppliersService } from '../suppliers/suppliers.service.js';
import { calculatePurchaseTotals, mergeDuplicatePurchaseItems } from './purchases.calculations.js';
import { PurchaseDomainError } from './purchases.errors.js';
import {
  type PurchaseLineRecord,
  type PurchaseProductSnapshot,
  type PurchaseWriteValues,
  PurchasesRepository,
} from './purchases.repository.js';

function normalizeNote(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  return value.trim() || null;
}

function assertNote(value: unknown): string | null {
  if (value !== undefined && value !== null && typeof value !== 'string') {
    throw new ApiException(HttpStatus.BAD_REQUEST, 'PURCHASE_NOTE_INVALID', 'یادداشت خرید معتبر نیست.');
  }
  const normalized = normalizeNote(value as string | null | undefined);
  if (normalized && normalized.length > 2000) {
    throw new ApiException(HttpStatus.BAD_REQUEST, 'PURCHASE_NOTE_INVALID', 'یادداشت خرید نمی‌تواند بیشتر از ۲۰۰۰ نویسه باشد.', [
      { field: 'note', message: 'یادداشت را کوتاه‌تر کنید.' },
    ]);
  }
  return normalized;
}

function copyExistingItems(purchase: PurchaseDetails): PurchaseItemInput[] {
  return purchase.items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
  }));
}

@Injectable()
export class PurchasesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly purchases: PurchasesRepository,
    private readonly suppliers: SuppliersService,
    private readonly inventory: InventoryService,
  ) {}

  async list(query: PurchaseListQuery): Promise<PaginatedData<PurchaseListItem>> {
    if (query.from && query.to && Date.parse(query.from) > Date.parse(query.to)) {
      throw this.domainException(new PurchaseDomainError(
        'PURCHASE_DATE_RANGE_INVALID',
        'بازهٔ زمانی فهرست خرید معتبر نیست.',
        HttpStatus.BAD_REQUEST,
        [{ field: 'from', message: 'زمان آغاز باید پیش از زمان پایان باشد.' }],
      ));
    }
    return this.purchases.list(query);
  }

  async get(id: string): Promise<PurchaseDetails> {
    const purchase = await this.purchases.findById(id);
    if (!purchase) throw this.notFound();
    return purchase;
  }

  async create(input: CreatePurchaseInput): Promise<PurchaseDetails> {
    return this.run(async () => {
      const mergedItems = mergeDuplicatePurchaseItems(input.items);
      const discount = input.discount === undefined ? 0 : input.discount;
      const totals = calculatePurchaseTotals(mergedItems, discount);
      const note = assertNote(input.note);
      return this.database.transaction(async (client) => {
        const supplier = await this.suppliers.getActiveForPurchase(client, input.supplierId);
        const products = await this.purchases.getActiveProductSnapshots(client, mergedItems.map((item) => item.productId));
        const values = this.makeWriteValues(supplier.id, note, mergedItems, totals, products);
        return this.purchases.createDraftWithClient(client, values);
      });
    });
  }

  async update(id: string, input: UpdatePurchaseInput): Promise<PurchaseDetails> {
    if (!Object.values(input).some((value) => value !== undefined)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'PURCHASE_INVALID', 'برای ویرایش خرید دست‌کم یک فیلد لازم است.');
    }
    return this.run(() => this.database.transaction(async (client) => {
      const current = await this.purchases.findByIdForUpdate(client, id);
      if (!current) throw this.notFound();
      this.assertDraft(current.status);

      const supplierId = input.supplierId ?? current.supplierId;
      const supplier = await this.suppliers.getActiveForPurchase(client, supplierId);
      const sourceItems = input.items === undefined ? copyExistingItems(current) : input.items;
      const mergedItems = mergeDuplicatePurchaseItems(sourceItems);
      const products = await this.purchases.getActiveProductSnapshots(client, mergedItems.map((item) => item.productId));
      const totals = calculatePurchaseTotals(
        mergedItems,
        input.discount === undefined ? current.discount : input.discount,
      );
      const note = input.note === undefined ? current.note : assertNote(input.note);
      const values = this.makeWriteValues(supplier.id, note, mergedItems, totals, products, current);
      return this.purchases.updateDraftWithClient(client, id, values);
    }));
  }

  async updateStatus(id: string, status: 'confirmed' | 'cancelled'): Promise<PurchaseDetails> {
    return this.run(() => this.database.transaction(async (client) => {
      const current = await this.purchases.findByIdForUpdate(client, id);
      if (!current) throw this.notFound();
      if (current.status !== 'draft') {
        if (current.status === 'confirmed') {
          throw this.domainException(new PurchaseDomainError(
            status === 'confirmed' ? 'PURCHASE_ALREADY_CONFIRMED' : 'PURCHASE_NOT_CONFIRMABLE',
            status === 'confirmed' ? 'این خرید قبلاً نهایی شده است.' : 'خرید نهایی‌شده قابل لغو نیست.',
            HttpStatus.CONFLICT,
          ));
        }
        throw this.domainException(new PurchaseDomainError(
          'PURCHASE_NOT_CONFIRMABLE',
          'خرید لغوشده قابل تغییر یا نهایی‌سازی نیست.',
          HttpStatus.CONFLICT,
        ));
      }

      if (status === 'cancelled') return this.purchases.setStatusWithClient(client, id, 'cancelled');

      await this.suppliers.getActiveForPurchase(client, current.supplierId);
      const orderedItems = [...current.items].sort((left, right) => left.productId.localeCompare(right.productId));
      await this.inventory.assertProductsAvailableInTransaction(client, orderedItems.map((item) => item.productId));
      for (const item of orderedItems) {
        await this.inventory.createMovementInTransaction(client, item.productId, {
          type: 'IN',
          quantity: item.quantity,
          note: `Purchase ${current.purchaseNumber}`,
        });
      }
      return this.purchases.setStatusWithClient(client, id, 'confirmed');
    }));
  }

  private makeWriteValues(
    supplierId: string,
    note: string | null,
    items: readonly PurchaseItemInput[],
    totals: ReturnType<typeof calculatePurchaseTotals>,
    products: Map<string, PurchaseProductSnapshot>,
    keepSnapshots?: PurchaseDetails,
  ): PurchaseWriteValues {
    const existingByProduct = new Map(keepSnapshots?.items.map((item) => [item.productId, item]));
    const lines: PurchaseLineRecord[] = items.map((item, index) => {
      const product = products.get(item.productId);
      if (!product) throw new Error('Validated product snapshot was not returned.');
      const existing = existingByProduct.get(item.productId);
      return {
        id: item.productId,
        name: existing?.productNameSnapshot ?? product.name,
        sku: existing?.productSkuSnapshot ?? product.sku,
        unit: existing?.unitSnapshot ?? product.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: totals.lineTotals[index]!,
      };
    });
    return {
      supplierId,
      note,
      items: lines,
      subtotal: totals.subtotal,
      discount: totals.discount,
      total: totals.total,
    };
  }

  private assertDraft(status: PurchaseStatus): void {
    if (status !== 'draft') {
      throw this.domainException(new PurchaseDomainError(
        'PURCHASE_NOT_EDITABLE',
        'فقط خرید پیش‌نویس قابل ویرایش است.',
        HttpStatus.CONFLICT,
      ));
    }
  }

  private notFound(): ApiException {
    return new ApiException(HttpStatus.NOT_FOUND, 'PURCHASE_NOT_FOUND', 'خرید موردنظر پیدا نشد.');
  }

  private domainException(error: PurchaseDomainError): ApiException {
    return new ApiException(error.status, error.code, error.message, error.details);
  }

  private async run<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof PurchaseDomainError) throw this.domainException(error);
      throw error;
    }
  }
}
