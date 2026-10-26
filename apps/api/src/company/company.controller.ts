import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CompanyService, type CompanyView } from './company.service';
import { UpdateCompanyDto } from './dto/company.dto';
import { CompanyScoped, RequirePermission } from '../common/decorators';

@Controller('company')
export class CompanyController {
  constructor(private readonly companies: CompanyService) {}

  @Get()
  @RequirePermission('company.view')
  get(): Promise<CompanyView> {
    return this.companies.getCurrent();
  }

  @Patch()
  @RequirePermission('company.settings.manage')
  update(@Body() body: UpdateCompanyDto): Promise<CompanyView> {
    return this.companies.update(body);
  }
}

@Controller('license')
export class LicenseController {
  constructor(private readonly companies: CompanyService) {}

  @Get()
  @RequirePermission('license.view')
  @CompanyScoped()
  get() {
    return this.companies.getLicense();
  }
}
