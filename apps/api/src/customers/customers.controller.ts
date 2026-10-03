import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import type { ApiSuccess, Customer, PaginatedData } from '@bazariya/shared';
import { ApiException } from '../common/errors/api.exception.js';
import { CreateCustomerDto, CustomersQueryDto, UpdateCustomerDto } from './customers.dto.js';
import { CustomersService } from './customers.service.js';

const customerIdPipe = new ParseUUIDPipe({
  version: '4',
  exceptionFactory: () => new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', 'شناسه مشتری معتبر نیست.'),
});

@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  async list(@Query() query: CustomersQueryDto): Promise<ApiSuccess<PaginatedData<Customer>>> {
    return { data: await this.customers.list(query) };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() input: CreateCustomerDto): Promise<ApiSuccess<Customer>> {
    return { data: await this.customers.create(input) };
  }

  @Get(':id')
  async get(@Param('id', customerIdPipe) id: string): Promise<ApiSuccess<Customer>> {
    return { data: await this.customers.get(id) };
  }

  @Patch(':id')
  async update(
    @Param('id', customerIdPipe) id: string,
    @Body() input: UpdateCustomerDto,
  ): Promise<ApiSuccess<Customer>> {
    return { data: await this.customers.update(id, input) };
  }

  @Delete(':id')
  async delete(@Param('id', customerIdPipe) id: string): Promise<ApiSuccess<{ id: string }>> {
    return { data: await this.customers.delete(id) };
  }
}
