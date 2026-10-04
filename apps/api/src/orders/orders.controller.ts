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
import type { ApiSuccess, OrderDetails, OrderListItem, PaginatedData } from '@bazariya/shared';
import { ApiException } from '../common/errors/api.exception.js';
import { CreateOrderDto, OrdersQueryDto, UpdateOrderDto, UpdateOrderStatusDto } from './orders.dto.js';
import { OrdersService } from './orders.service.js';

const uuidPipe = new ParseUUIDPipe({
  version: '4',
  exceptionFactory: () => new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', 'شناسه سفارش معتبر نیست.'),
});

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  async list(@Query() query: OrdersQueryDto): Promise<ApiSuccess<PaginatedData<OrderListItem>>> {
    return { data: await this.orders.list(query) };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() input: CreateOrderDto): Promise<ApiSuccess<OrderDetails>> {
    return { data: await this.orders.create(input) };
  }

  @Get(':id')
  async get(@Param('id', uuidPipe) id: string): Promise<ApiSuccess<OrderDetails>> {
    return { data: await this.orders.get(id) };
  }

  @Patch(':id')
  async update(
    @Param('id', uuidPipe) id: string,
    @Body() input: UpdateOrderDto,
  ): Promise<ApiSuccess<OrderDetails>> {
    return { data: await this.orders.update(id, input) };
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', uuidPipe) id: string,
    @Body() input: UpdateOrderStatusDto,
  ): Promise<ApiSuccess<OrderDetails>> {
    return { data: await this.orders.updateStatus(id, input.status) };
  }
}
