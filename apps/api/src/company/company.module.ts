import { Module } from '@nestjs/common';
import { CompanyController, LicenseController } from './company.controller';
import { CompanyService } from './company.service';

@Module({
  controllers: [CompanyController, LicenseController],
  providers: [CompanyService],
})
export class CompanyModule {}
