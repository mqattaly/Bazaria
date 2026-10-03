import { ConflictException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import type { Category, CategoryListItem, CreateCategoryInput, UpdateCategoryInput } from '@bazariya/shared';
import { ApiException } from '../../common/errors/api.exception.js';
import { isPostgresError } from '../../common/errors/postgres-error.js';
import { CategoriesRepository } from './categories.repository.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly categories: CategoriesRepository) {}

  list(): Promise<CategoryListItem[]> {
    return this.categories.list();
  }

  async get(id: string): Promise<Category> {
    const category = await this.categories.findById(id);
    if (!category) throw this.notFound();
    return category;
  }

  async create(input: CreateCategoryInput): Promise<Category> {
    try {
      return await this.categories.create({
        ...input,
        name: input.name.trim(),
        description: input.description?.trim() || null,
      });
    } catch (error) {
      this.throwIfDuplicateName(error);
      throw error;
    }
  }

  async update(id: string, input: UpdateCategoryInput): Promise<Category> {
    if (!Object.values(input).some((value) => value !== undefined)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'EMPTY_PATCH', 'دست‌کم یک فیلد برای ویرایش لازم است.');
    }

    const normalized: UpdateCategoryInput = {
      ...input,
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
    };

    try {
      const category = await this.categories.update(id, normalized);
      if (!category) throw this.notFound();
      return category;
    } catch (error) {
      this.throwIfDuplicateName(error);
      throw error;
    }
  }

  async delete(id: string): Promise<{ id: string }> {
    try {
      const deleted = await this.categories.delete(id);
      if (!deleted) throw this.notFound();
      return { id };
    } catch (error) {
      if (isPostgresError(error) && error.code === '23503' && error.constraint === 'products_category_id_fkey') {
        throw new ConflictException({
          error: {
            code: 'CATEGORY_HAS_PRODUCTS',
            message: 'این دسته‌بندی دارای محصول است و نمی‌توان آن را حذف کرد.',
          },
        });
      }
      throw error;
    }
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      error: {
        code: 'CATEGORY_NOT_FOUND',
        message: 'دسته‌بندی پیدا نشد.',
      },
    });
  }

  private throwIfDuplicateName(error: unknown): void {
    if (isPostgresError(error) && error.code === '23505' && error.constraint === 'categories_name_unique') {
      throw new ConflictException({
        error: {
          code: 'CATEGORY_NAME_EXISTS',
          message: 'این نام دسته‌بندی قبلاً ثبت شده است.',
          details: [{ field: 'name', message: 'نام دسته‌بندی باید یکتا باشد.' }],
        },
      });
    }
  }
}
