import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PlatformAuthService } from './platform-auth.service';
import {
  PlatformCompanyService,
  type CreateCompanyResult,
  type PlatformCompanyView,
} from './platform-company.service';
import {
  CreateCompanyDto,
  RenewLicenseDto,
  UpdateLicenseDto,
} from '../company/dto/company.dto';
import { PlatformLoginDto } from '../auth/dto/auth.dto';
import {
  Public,
  PlatformRoute,
  RequirePlatformPermission,
} from '../common/decorators';
import { currentStore } from '../common/request-context';
import {
  clearPlatformSessionCookie,
  setPlatformSessionCookie,
} from '../auth/auth-cookies';

@Controller('platform/auth')
export class PlatformAuthController {
  constructor(private readonly platformAuth: PlatformAuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: PlatformLoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<unknown> {
    const result = await this.platformAuth.login(
      body.username,
      body.password,
      request.ip,
      request.header('user-agent') ?? undefined,
    );
    setPlatformSessionCookie(response, result.token, result.expiresAt);
    return { admin: result.admin };
  }

  @PlatformRoute()
  @Post('logout')
  @HttpCode(200)
  async logout(@Res({ passthrough: true }) response: Response): Promise<unknown> {
    const store = currentStore();
    if (store.sessionId) {
      await this.platformAuth.revokeCurrentSession(store.sessionId);
    }
    clearPlatformSessionCookie(response);
    return { ok: true };
  }

  @PlatformRoute()
  @Get('me')
  me(): unknown {
    return { admin: currentStore().platformAdmin };
  }
}

@Controller('platform/companies')
export class PlatformCompaniesController {
  constructor(private readonly companies: PlatformCompanyService) {}

  @PlatformRoute()
  @RequirePlatformPermission('platform.company.manage')
  @Get()
  list(): Promise<PlatformCompanyView[]> {
    return this.companies.list();
  }

  @PlatformRoute()
  @RequirePlatformPermission('platform.company.manage')
  @Post()
  create(@Body() body: CreateCompanyDto): Promise<CreateCompanyResult> {
    return this.companies.create(body);
  }

  @PlatformRoute()
  @RequirePlatformPermission('platform.license.manage')
  @Patch(':companyId/license')
  updateLicense(
    @Param('companyId') companyId: string,
    @Body() body: UpdateLicenseDto,
  ) {
    return this.companies.updateLicense(companyId, body);
  }

  @PlatformRoute()
  @RequirePlatformPermission('platform.license.manage')
  @Post(':companyId/license/renew')
  @HttpCode(200)
  renewLicense(
    @Param('companyId') companyId: string,
    @Body() body: RenewLicenseDto,
  ) {
    return this.companies.renewLicense(companyId, body.days);
  }
}
