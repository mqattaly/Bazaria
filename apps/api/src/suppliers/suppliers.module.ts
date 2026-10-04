import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { SuppliersController } from './suppliers.controller.js';
import { SuppliersRepository } from './suppliers.repository.js';
import { SuppliersService } from './suppliers.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [SuppliersController],
  providers: [SuppliersRepository, SuppliersService],
  exports: [SuppliersService],
})
export class SuppliersModule {}
