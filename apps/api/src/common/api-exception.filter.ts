import {
  Catch,
  HttpException,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import { ERROR_MESSAGES_FA, type ApiErrorBody, type ErrorCode } from '@bazaria/shared';
import { AppError } from './errors';
import { currentRequestId } from './request-context';

const FALLBACK_MESSAGES: Partial<Record<ErrorCode, string>> = {
  RESOURCE_NOT_FOUND: ERROR_MESSAGES_FA.RESOURCE_NOT_FOUND,
  MALFORMED_REQUEST: ERROR_MESSAGES_FA.MALFORMED_REQUEST,
};

/**
 * Last line of defense for error responses: stable code, Persian message,
 * request id, and never a stack trace, SQL text or raw exception message.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    if (response.headersSent) return;

    const requestId = currentRequestId();
    let status = 500;
    let code: ErrorCode = 'INTERNAL_ERROR';
    let message: string = ERROR_MESSAGES_FA.INTERNAL_ERROR;
    let details: ApiErrorBody['error']['details'];
    let meta: ApiErrorBody['error']['meta'];
    let retryable = false;

    if (exception instanceof AppError) {
      status = exception.status;
      code = exception.code;
      message = exception.message;
      details = exception.details;
      meta = exception.meta;
      retryable = exception.retryable;
    } else if (exception instanceof HttpException) {
      const exceptionStatus = exception.getStatus();
      if (exceptionStatus === 404) {
        status = 404;
        code = 'RESOURCE_NOT_FOUND';
      } else if (exceptionStatus === 413) {
        status = 400;
        code = 'MALFORMED_REQUEST';
      } else if (exceptionStatus === 429) {
        status = 429;
        code = 'RATE_LIMITED';
        retryable = true;
      } else if (exceptionStatus >= 500) {
        status = 500;
        code = 'INTERNAL_ERROR';
      } else {
        status = 400;
        code = 'MALFORMED_REQUEST';
      }
      message = FALLBACK_MESSAGES[code] ?? ERROR_MESSAGES_FA[code];
    } else if (
      exception instanceof SyntaxError &&
      'body' in (exception as unknown as Record<string, unknown>)
    ) {
      status = 400;
      code = 'MALFORMED_REQUEST';
      message = ERROR_MESSAGES_FA.MALFORMED_REQUEST;
    }

    if (status >= 500) {
      const errorMessage =
        exception instanceof Error ? exception.message : 'Unknown error';
      this.logger.error(`request=${requestId} code=${code} message=${errorMessage}`);
    } else {
      this.logger.warn(`request=${requestId} code=${code} status=${status}`);
    }

    const body: ApiErrorBody = {
      error: {
        code,
        message,
        ...(details ? { details } : {}),
        ...(meta ? { meta } : {}),
        requestId,
        retryable,
      },
    };
    response.status(status).json(body);
  }
}
