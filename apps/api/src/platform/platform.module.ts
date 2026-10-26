import { Module } from '@nestjs/common';
import {
  PlatformAuthController,
  PlatformCompaniesController,
} from './platform.controller';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformCompanyService } from './platform-company.service';

@Module({
  controllers: [PlatformAuthController, PlatformCompaniesController],
  providers: [PlatformAuthService, PlatformCompanyService],
})
export class PlatformModule {}
