import { Controller, Get } from '@nestjs/common';
import type { ApiSuccess, HealthData } from '@bazariya/shared';
import { HealthService } from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  async getHealth(): Promise<ApiSuccess<HealthData>> {
    return { data: await this.health.check() };
  }
}
