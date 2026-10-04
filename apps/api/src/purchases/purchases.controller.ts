import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import type { ApiSuccess, PaginatedData, PurchaseDetails, PurchaseListItem } from '@bazariya/shared';
import { ApiException } from '../common/errors/api.exception.js';
import {
  CreatePurchaseDto,
  PurchasesQueryDto,
  UpdatePurchaseDto,
  UpdatePurchaseStatusDto,
} from './purchases.dto.js';
import { PurchasesService } from './purchases.service.js';

const purchaseIdPipe = new ParseUUIDPipe({
  version: '4',
  exceptionFactory: () => new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', 'شناسهٔ خرید معتبر نیست.'),
});

@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchases: PurchasesService) {}

  @Get()
  async list(@Query() query: PurchasesQueryDto): Promise<ApiSuccess<PaginatedData<PurchaseListItem>>> {
    return { data: await this.purchases.list(query) };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() input: CreatePurchaseDto): Promise<ApiSuccess<PurchaseDetails>> {
    return { data: await this.purchases.create(input) };
  }

  @Get(':id')
  async get(@Param('id', purchaseIdPipe) id: string): Promise<ApiSuccess<PurchaseDetails>> {
    return { data: await this.purchases.get(id) };
  }

  @Patch(':id')
  async update(
    @Param('id', purchaseIdPipe) id: string,
    @Body() input: UpdatePurchaseDto,
  ): Promise<ApiSuccess<PurchaseDetails>> {
    return { data: await this.purchases.update(id, input) };
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', purchaseIdPipe) id: string,
    @Body() input: UpdatePurchaseStatusDto,
  ): Promise<ApiSuccess<PurchaseDetails>> {
    return { data: await this.purchases.updateStatus(id, input.status) };
  }
}
