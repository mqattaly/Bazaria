import { Controller, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { MeResponse, MyCompany } from '@bazaria/shared';

@Controller()
export class MeController {
  constructor(private readonly auth: AuthService) {}

  @Get('me')
  me(): Promise<MeResponse> {
    return this.auth.me();
  }

  @Get('me/companies')
  companies(): Promise<MyCompany[]> {
    return this.auth.myCompanies();
  }
}
