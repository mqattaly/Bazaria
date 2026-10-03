import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { CategoriesController } from './categories/categories.controller.js';
import { CategoriesRepository } from './categories/categories.repository.js';
import { CategoriesService } from './categories/categories.service.js';
import { ProductsController } from './products/products.controller.js';
import { ProductsRepository } from './products/products.repository.js';
import { ProductsService } from './products/products.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [CategoriesController, ProductsController],
  providers: [CategoriesRepository, CategoriesService, ProductsRepository, ProductsService],
})
export class CatalogModule {}
