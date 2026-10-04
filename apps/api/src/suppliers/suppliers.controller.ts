import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import type { ApiSuccess, PaginatedData, Supplier } from '@bazariya/shared';
import { ApiException } from '../common/errors/api.exception.js';
import {
  CreateSupplierDto,
  SuppliersQueryDto,
  UpdateSupplierDto,
  UpdateSupplierStatusDto,
} from './suppliers.dto.js';
import { SuppliersService } from './suppliers.service.js';

const supplierIdPipe = new ParseUUIDPipe({
  version: '4',
  exceptionFactory: () => new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', 'شناسهٔ تأمین‌کننده معتبر نیست.'),
});

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  async list(@Query() query: SuppliersQueryDto): Promise<ApiSuccess<PaginatedData<Supplier>>> {
    return { data: await this.suppliers.list(query) };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() input: CreateSupplierDto): Promise<ApiSuccess<Supplier>> {
    return { data: await this.suppliers.create(input) };
  }

  @Get(':id')
  async get(@Param('id', supplierIdPipe) id: string): Promise<ApiSuccess<Supplier>> {
    return { data: await this.suppliers.get(id) };
  }

  @Patch(':id')
  async update(
    @Param('id', supplierIdPipe) id: string,
    @Body() input: UpdateSupplierDto,
  ): Promise<ApiSuccess<Supplier>> {
    return { data: await this.suppliers.update(id, input) };
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', supplierIdPipe) id: string,
    @Body() input: UpdateSupplierStatusDto,
  ): Promise<ApiSuccess<Supplier>> {
    return { data: await this.suppliers.updateStatus(id, input.isActive) };
  }

  @Delete(':id')
  async delete(@Param('id', supplierIdPipe) id: string): Promise<ApiSuccess<{ id: string }>> {
    return { data: await this.suppliers.delete(id) };
  }
}
