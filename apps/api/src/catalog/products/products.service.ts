import { ConflictException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateProductInput,
  PaginatedData,
  Product,
  ProductListQuery,
  UpdateProductInput,
} from '@bazariya/shared';
import { ApiException } from '../../common/errors/api.exception.js';
import { isPostgresError } from '../../common/errors/postgres-error.js';
import { CategoriesRepository } from '../categories/categories.repository.js';
import { ProductsRepository } from './products.repository.js';

@Injectable()
export class ProductsService {
  constructor(
    private readonly products: ProductsRepository,
    private readonly categories: CategoriesRepository,
  ) {}

  list(query: ProductListQuery): Promise<PaginatedData<Product>> {
    return this.products.list(query);
  }

  async get(id: string): Promise<Product> {
    const product = await this.products.findById(id);
    if (!product) throw this.notFound();
    return product;
  }

  async create(input: CreateProductInput): Promise<Product> {
    await this.assertCategoryExists(input.categoryId);
    const normalized: CreateProductInput = {
      ...input,
      name: input.name.trim(),
      sku: input.sku.trim().toUpperCase(),
      description: input.description?.trim() || null,
    };

    try {
      return await this.products.create(normalized);
    } catch (error) {
      this.throwKnownWriteError(error);
      throw error;
    }
  }

  async update(id: string, input: UpdateProductInput): Promise<Product> {
    if (!Object.values(input).some((value) => value !== undefined)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'EMPTY_PATCH', 'دست‌کم یک فیلد برای ویرایش لازم است.');
    }

    if (!(await this.products.findById(id))) throw this.notFound();
    if (input.categoryId !== undefined) await this.assertCategoryExists(input.categoryId);

    const normalized: UpdateProductInput = {
      ...input,
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.sku !== undefined ? { sku: input.sku.trim().toUpperCase() } : {}),
      ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
    };

    try {
      const product = await this.products.update(id, normalized);
      if (!product) throw this.notFound();
      return product;
    } catch (error) {
      this.throwKnownWriteError(error);
      throw error;
    }
  }

  async delete(id: string): Promise<{ id: string }> {
    try {
      const deleted = await this.products.delete(id);
      if (!deleted) throw this.notFound();
      return { id };
    } catch (error) {
      if (isPostgresError(error) && error.code === '23503' && error.constraint === 'stock_movements_product_id_fkey') {
        throw new ConflictException({
          error: {
            code: 'PRODUCT_HAS_STOCK_HISTORY',
            message: 'این محصول سابقهٔ گردش موجودی دارد و برای حفظ تاریخچه قابل حذف نیست.',
          },
        });
      }
      throw error;
    }
  }

  private async assertCategoryExists(categoryId: string): Promise<void> {
    if (!(await this.categories.exists(categoryId))) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'CATEGORY_NOT_FOUND', 'دسته‌بندی انتخاب‌شده پیدا نشد.', [
        { field: 'categoryId', message: 'یک دسته‌بندی معتبر انتخاب کنید.' },
      ]);
    }
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      error: {
        code: 'PRODUCT_NOT_FOUND',
        message: 'محصول پیدا نشد.',
      },
    });
  }

  private throwKnownWriteError(error: unknown): void {
    if (!isPostgresError(error)) return;
    if (error.code === '23505' && error.constraint === 'products_sku_unique') {
      throw new ConflictException({
        error: {
          code: 'PRODUCT_SKU_EXISTS',
          message: 'این کد کالا قبلاً ثبت شده است.',
          details: [{ field: 'sku', message: 'یک کد کالای دیگر وارد کنید.' }],
        },
      });
    }
    if (error.code === '23503' && error.constraint === 'products_category_id_fkey') {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'CATEGORY_NOT_FOUND', 'دسته‌بندی انتخاب‌شده پیدا نشد.', [
        { field: 'categoryId', message: 'یک دسته‌بندی معتبر انتخاب کنید.' },
      ]);
    }
  }
}
