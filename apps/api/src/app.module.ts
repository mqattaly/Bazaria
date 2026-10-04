import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { getEnvironmentFilePaths } from './config/env-paths.js';
import { validateEnvironment } from './config/environment.js';
import { HealthModule } from './health/health.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { CustomersModule } from './customers/customers.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { PurchasesModule } from './purchases/purchases.module.js';
import { SuppliersModule } from './suppliers/suppliers.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: getEnvironmentFilePaths(),
      validate: validateEnvironment,
    }),
    HealthModule,
    CatalogModule,
    CustomersModule,
    OrdersModule,
    InventoryModule,
    SuppliersModule,
    PurchasesModule,
  ],
})
export class AppModule {}
