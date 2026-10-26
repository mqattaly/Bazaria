import { Injectable, Logger } from '@nestjs/common';

export interface LogFields {
  requestId?: string;
  userId?: string;
  companyId?: string;
  route?: string;
  status?: number;
}

/**
 * Minimal structured logger. Callers must never pass request bodies, passwords,
 * tokens or raw SQL parameters.
 */
@Injectable()
export class AppLogger {
  private readonly logger = new Logger('bazaria');

  info(message: string, fields: LogFields = {}): void {
    this.logger.log(JSON.stringify({ message, ...fields }));
  }

  warn(message: string, fields: LogFields = {}): void {
    this.logger.warn(JSON.stringify({ message, ...fields }));
  }

  error(message: string, fields: LogFields = {}): void {
    this.logger.error(JSON.stringify({ message, ...fields }));
  }
}
