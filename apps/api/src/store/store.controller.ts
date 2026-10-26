import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { RequirePermission } from '../common/decorators';
import { StoreService } from './store.service';
import {
  CreateStoreDto,
  ListStoresQueryDto,
  UpdateStoreDto,
  UpdateStoreStatusDto,
} from './store.dto';

@Controller('stores')
export class StoreController {
  constructor(private readonly stores: StoreService) {}

  @Get()
  @RequirePermission('store.view')
  list(@Query() query: ListStoresQueryDto) {
    return this.stores.list(query);
  }

  @Get(':storeId')
  @RequirePermission('store.view')
  get(@Param('storeId') storeId: string) {
    return this.stores.get(storeId);
  }

  @Post()
  @RequirePermission('store.create')
  create(@Body() body: CreateStoreDto) {
    return this.stores.create(body);
  }

  @Patch(':storeId')
  @RequirePermission('store.update')
  update(@Param('storeId') storeId: string, @Body() body: UpdateStoreDto) {
    return this.stores.update(storeId, body);
  }

  @Patch(':storeId/status')
  @RequirePermission('store.deactivate')
  updateStatus(
    @Param('storeId') storeId: string,
    @Body() body: UpdateStoreStatusDto,
  ) {
    return this.stores.updateStatus(storeId, body.status);
  }
}
