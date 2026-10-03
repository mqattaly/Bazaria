import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import type { ApiSuccess, PaginatedData, Product } from '@bazariya/shared';
import { ApiException } from '../../common/errors/api.exception.js';
import { CreateProductDto, ProductsQueryDto, UpdateProductDto } from './products.dto.js';
import { ProductsService } from './products.service.js';

const uuidPipe = new ParseUUIDPipe({
  version: '4',
  exceptionFactory: () => new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', 'شناسه محصول معتبر نیست.'),
});

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  async list(@Query() query: ProductsQueryDto): Promise<ApiSuccess<PaginatedData<Product>>> {
    return { data: await this.products.list(query) };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() input: CreateProductDto): Promise<ApiSuccess<Product>> {
    return { data: await this.products.create(input) };
  }

  @Get(':id')
  async get(@Param('id', uuidPipe) id: string): Promise<ApiSuccess<Product>> {
    return { data: await this.products.get(id) };
  }

  @Patch(':id')
  async update(
    @Param('id', uuidPipe) id: string,
    @Body() input: UpdateProductDto,
  ): Promise<ApiSuccess<Product>> {
    return { data: await this.products.update(id, input) };
  }

  @Delete(':id')
  async delete(@Param('id', uuidPipe) id: string): Promise<ApiSuccess<{ id: string }>> {
    return { data: await this.products.delete(id) };
  }
}
