import { HttpException } from '@nestjs/common';
import type { ApiError } from '@bazariya/shared';

export class ApiException extends HttpException {
  constructor(status: number, code: string, message: string, details?: ApiError['error']['details']) {
    super(
      {
        error: {
          code,
          message,
          ...(details && details.length > 0 ? { details } : {}),
        },
      } satisfies ApiError,
      status,
    );
  }
}
