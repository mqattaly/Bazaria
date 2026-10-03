import { HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { isEmail } from 'class-validator';
import type {
  CreateCustomerInput,
  Customer,
  CustomerListQuery,
  PaginatedData,
  UpdateCustomerInput,
} from '@bazariya/shared';
import { ApiException } from '../common/errors/api.exception.js';
import { CustomersRepository } from './customers.repository.js';
import { isValidCustomerPhone, normalizeEmail, normalizeOptionalText, normalizePhone } from './customers.validation.js';

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(private readonly customers: CustomersRepository) {}

  list(query: CustomerListQuery): Promise<PaginatedData<Customer>> {
    return this.customers.list(query);
  }

  async get(id: string): Promise<Customer> {
    const customer = await this.customers.findById(id);
    if (!customer) throw this.notFound();
    return customer;
  }

  async create(input: CreateCustomerInput): Promise<Customer> {
    const normalized: CreateCustomerInput = {
      ...input,
      name: input.name.trim(),
      phone: input.phone === undefined ? undefined : normalizePhone(input.phone),
      email: input.email === undefined ? undefined : normalizeEmail(input.email),
      address: input.address === undefined ? undefined : normalizeOptionalText(input.address),
      description: input.description === undefined ? undefined : normalizeOptionalText(input.description),
    };
    this.validateContactDetails(normalized);
    return this.customers.create(normalized);
  }

  async update(id: string, input: UpdateCustomerInput): Promise<Customer> {
    if (!Object.values(input).some((value) => value !== undefined)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'CUSTOMER_INVALID', 'برای ویرایش مشتری دست‌کم یک فیلد لازم است.');
    }

    if (!(await this.customers.findById(id))) throw this.notFound();

    const normalized: UpdateCustomerInput = {
      ...input,
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.phone !== undefined ? { phone: normalizePhone(input.phone) } : {}),
      ...(input.email !== undefined ? { email: normalizeEmail(input.email) } : {}),
      ...(input.address !== undefined ? { address: normalizeOptionalText(input.address) } : {}),
      ...(input.description !== undefined ? { description: normalizeOptionalText(input.description) } : {}),
    };
    this.validateContactDetails(normalized);

    const customer = await this.customers.update(id, normalized);
    if (!customer) throw this.notFound();
    return customer;
  }

  async delete(id: string): Promise<{ id: string }> {
    let deleted: boolean;
    try {
      deleted = await this.customers.delete(id);
    } catch (error) {
      this.logger.error('Customer deletion failed', error instanceof Error ? error.stack : String(error));
      throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, 'CUSTOMER_DELETE_FAILED', 'حذف مشتری انجام نشد.');
    }
    if (!deleted) throw this.notFound();
    return { id };
  }

  private validateContactDetails(input: CreateCustomerInput | UpdateCustomerInput): void {
    if (input.phone !== undefined && input.phone !== null && !isValidCustomerPhone(input.phone)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'CUSTOMER_PHONE_INVALID', 'شماره تماس مشتری معتبر نیست.', [
        { field: 'phone', message: 'شماره تماس را با قالبی مانند 09121234567 یا 02112345678 وارد کنید.' },
      ]);
    }
    if (input.email !== undefined && input.email !== null && !isEmail(input.email)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'CUSTOMER_EMAIL_INVALID', 'ایمیل مشتری معتبر نیست.', [
        { field: 'email', message: 'یک نشانی ایمیل معتبر وارد کنید.' },
      ]);
    }
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      error: {
        code: 'CUSTOMER_NOT_FOUND',
        message: 'مشتری موردنظر پیدا نشد.',
      },
    });
  }
}
