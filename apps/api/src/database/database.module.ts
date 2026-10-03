import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { PG_POOL } from './database.constants.js';
import { DatabaseService } from './database.service.js';

@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Pool =>
        new Pool({
          connectionString: config.getOrThrow<string>('DATABASE_URL'),
          application_name: 'bazariya-api',
          max: 10,
        }),
    },
    DatabaseService,
  ],
  exports: [DatabaseService],
})
export class DatabaseModule {}
