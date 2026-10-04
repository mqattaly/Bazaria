import { ConflictException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { isEmail } from 'class-validator';
import type {
  CreateSupplierInput,
  Supplier,
  SupplierListQuery,
  PaginatedData,
  UpdateSupplierInput,
} from '@bazariya/shared';
import type { PoolClient } from 'pg';
import { ApiException } from '../common/errors/api.exception.js';
import { isPostgresError } from '../common/errors/postgres-error.js';
import { SuppliersRepository } from './suppliers.repository.js';

function optionalText(value: string | null | undefined): string | null | undefined {
  if (value === undefined || value === null) return value;
  return value.trim() || null;
}

function normalizeEmail(value: string | null | undefined): string | null | undefined {
  const normalized = optionalText(value);
  return typeof normalized === 'string' ? normalized.toLocaleLowerCase('en-US') : normalized;
}

@Injectable()
export class SuppliersService {
  constructor(private readonly suppliers: SuppliersRepository) {}

  list(query: SupplierListQuery): Promise<PaginatedData<Supplier>> {
    return this.suppliers.list(query);
  }

  async get(id: string): Promise<Supplier> {
    const supplier = await this.suppliers.findById(id);
    if (!supplier) throw this.notFound();
    return supplier;
  }

  async getActiveForPurchase(client: PoolClient, id: string): Promise<Supplier> {
    const supplier = await this.suppliers.findForPurchase(client, id);
    if (!supplier) throw new ApiException(HttpStatus.NOT_FOUND, 'SUPPLIER_NOT_FOUND', 'تأمین‌کنندهٔ خرید پیدا نشد.');
    if (!supplier.isActive) {
      throw new ApiException(HttpStatus.CONFLICT, 'SUPPLIER_NOT_ACTIVE', 'برای خرید فقط می‌توان از تأمین‌کنندهٔ فعال استفاده کرد.');
    }
    return supplier;
  }

  async create(input: CreateSupplierInput): Promise<Supplier> {
    const normalized: CreateSupplierInput = {
      ...input,
      name: input.name.trim(),
      phone: optionalText(input.phone),
      email: normalizeEmail(input.email),
      address: optionalText(input.address),
      note: optionalText(input.note),
    };
    this.validateEmail(normalized.email);
    return this.suppliers.create(normalized);
  }

  async update(id: string, input: UpdateSupplierInput): Promise<Supplier> {
    if (!Object.values(input).some((value) => value !== undefined)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'SUPPLIER_INVALID', 'برای ویرایش تأمین‌کننده دست‌کم یک فیلد لازم است.');
    }
    if (!(await this.suppliers.findById(id))) throw this.notFound();

    const normalized: UpdateSupplierInput = {
      ...input,
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.phone !== undefined ? { phone: optionalText(input.phone) } : {}),
      ...(input.email !== undefined ? { email: normalizeEmail(input.email) } : {}),
      ...(input.address !== undefined ? { address: optionalText(input.address) } : {}),
      ...(input.note !== undefined ? { note: optionalText(input.note) } : {}),
    };
    this.validateEmail(normalized.email);

    const supplier = await this.suppliers.update(id, normalized);
    if (!supplier) throw this.notFound();
    return supplier;
  }

  async updateStatus(id: string, isActive: boolean): Promise<Supplier> {
    const supplier = await this.suppliers.updateStatus(id, isActive);
    if (!supplier) throw this.notFound();
    return supplier;
  }

  async delete(id: string): Promise<{ id: string }> {
    if (await this.suppliers.hasPurchaseHistory(id)) throw this.purchaseHistoryConflict();
    try {
      const deleted = await this.suppliers.delete(id);
      if (!deleted) throw this.notFound();
      return { id };
    } catch (error) {
      if (isPostgresError(error) && error.code === '23503' && error.constraint === 'purchases_supplier_id_fkey') {
        throw this.purchaseHistoryConflict();
      }
      throw error;
    }
  }

  private purchaseHistoryConflict(): ConflictException {
    return new ConflictException({
      error: {
        code: 'SUPPLIER_HAS_PURCHASE_HISTORY',
        message: 'این تأمین‌کننده سابقهٔ خرید دارد؛ برای حفظ تاریخچه آن را غیرفعال کنید.',
      },
    });
  }

  private validateEmail(email: string | null | undefined): void {
    if (email !== undefined && email !== null && !isEmail(email)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'SUPPLIER_EMAIL_INVALID', 'ایمیل تأمین‌کننده معتبر نیست.', [
        { field: 'email', message: 'یک نشانی ایمیل معتبر وارد کنید.' },
      ]);
    }
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      error: {
        code: 'SUPPLIER_NOT_FOUND',
        message: 'تأمین‌کنندهٔ موردنظر پیدا نشد.',
      },
    });
  }
}
