import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { HealthData } from '@bazariya/shared';
import { DatabaseService } from '../database/database.service.js';

@Injectable()
export class HealthService {
  constructor(private readonly database: DatabaseService) {}

  async check(): Promise<HealthData> {
    try {
      await this.database.ping();
    } catch (cause) {
      throw new ServiceUnavailableException('Database is unavailable', { cause });
    }

    return {
      status: 'ok',
      service: 'bazariya-api',
      database: 'connected',
    };
  }
}
