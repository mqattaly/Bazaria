import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type {
  ApiSuccess,
  CreateStockMovementResult,
  InventoryItem,
  PaginatedData,
  StockMovement,
} from '@bazariya/shared';
import { ApiException } from '../common/errors/api.exception.js';
import { CreateStockMovementDto, InventoryQueryDto, StockMovementQueryDto, UpdateInventoryMinimumDto } from './inventory.dto.js';
import { InventoryService } from './inventory.service.js';

const productIdPipe = new ParseUUIDPipe({
  version: '4',
  exceptionFactory: () => new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', 'شناسهٔ محصول معتبر نیست.'),
});

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  async list(@Query() query: InventoryQueryDto): Promise<ApiSuccess<PaginatedData<InventoryItem>>> {
    return { data: await this.inventory.list(query) };
  }

  @Get(':productId')
  async get(@Param('productId', productIdPipe) productId: string): Promise<ApiSuccess<InventoryItem>> {
    return { data: await this.inventory.get(productId) };
  }

  @Patch(':productId/minimum')
  async updateMinimum(
    @Param('productId', productIdPipe) productId: string,
    @Body() input: UpdateInventoryMinimumDto,
  ): Promise<ApiSuccess<InventoryItem>> {
    return { data: await this.inventory.updateMinimum(productId, input) };
  }

  @Post(':productId/movements')
  @HttpCode(HttpStatus.CREATED)
  async createMovement(
    @Param('productId', productIdPipe) productId: string,
    @Body() input: CreateStockMovementDto,
  ): Promise<ApiSuccess<CreateStockMovementResult>> {
    return { data: await this.inventory.createMovement(productId, input) };
  }

  @Get(':productId/movements')
  async listMovements(
    @Param('productId', productIdPipe) productId: string,
    @Query() query: StockMovementQueryDto,
  ): Promise<ApiSuccess<PaginatedData<StockMovement>>> {
    return { data: await this.inventory.listMovements(productId, query) };
  }
}
