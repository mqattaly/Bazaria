import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { SuppliersModule } from '../suppliers/suppliers.module.js';
import { PurchasesController } from './purchases.controller.js';
import { PurchasesRepository } from './purchases.repository.js';
import { PurchasesService } from './purchases.service.js';

@Module({
  imports: [DatabaseModule, SuppliersModule, InventoryModule],
  controllers: [PurchasesController],
  providers: [PurchasesRepository, PurchasesService],
  exports: [PurchasesService],
})
export class PurchasesModule {}
