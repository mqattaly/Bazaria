import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import type { ApiSuccess, Category, CategoryListItem } from '@bazariya/shared';
import { ApiException } from '../../common/errors/api.exception.js';
import { CreateCategoryDto, UpdateCategoryDto } from './categories.dto.js';
import { CategoriesService } from './categories.service.js';

const uuidPipe = new ParseUUIDPipe({
  version: '4',
  exceptionFactory: () => new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', 'شناسه دسته‌بندی معتبر نیست.'),
});

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  async list(): Promise<ApiSuccess<CategoryListItem[]>> {
    return { data: await this.categories.list() };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() input: CreateCategoryDto): Promise<ApiSuccess<Category>> {
    return { data: await this.categories.create(input) };
  }

  @Get(':id')
  async get(@Param('id', uuidPipe) id: string): Promise<ApiSuccess<Category>> {
    return { data: await this.categories.get(id) };
  }

  @Patch(':id')
  async update(
    @Param('id', uuidPipe) id: string,
    @Body() input: UpdateCategoryDto,
  ): Promise<ApiSuccess<Category>> {
    return { data: await this.categories.update(id, input) };
  }

  @Delete(':id')
  async delete(@Param('id', uuidPipe) id: string): Promise<ApiSuccess<{ id: string }>> {
    return { data: await this.categories.delete(id) };
  }
}
