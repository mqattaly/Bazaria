import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { ApiError } from '@bazariya/shared';

interface HttpResponse {
  status(code: number): HttpResponse;
  json(body: ApiError): void;
}

interface ExceptionBody {
  message?: string | string[];
}

function isApiError(value: unknown): value is ApiError {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;
  const error = value.error;
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && typeof error.code === 'string'
    && 'message' in error
    && typeof error.message === 'string';
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<HttpResponse>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    if (!(exception instanceof HttpException)) {
      this.logger.error('Unhandled request exception', exception instanceof Error ? exception.stack : String(exception));
    }
    const body = exception instanceof HttpException ? exception.getResponse() : undefined;
    if (isApiError(body)) {
      response.status(status).json(body);
      return;
    }
    const exceptionBody = typeof body === 'object' && body !== null ? (body as ExceptionBody) : undefined;
    const validationMessages = Array.isArray(exceptionBody?.message) ? exceptionBody.message : [];
    const message =
      typeof exceptionBody?.message === 'string'
        ? exceptionBody.message
        : status >= HttpStatus.INTERNAL_SERVER_ERROR
          ? 'The request could not be completed.'
          : 'The request is invalid.';

    const payload: ApiError = {
      error: {
        code: this.getErrorCode(status),
        message,
        ...(validationMessages.length > 0
          ? { details: validationMessages.map((detail) => ({ message: detail })) }
          : {}),
      },
    };

    response.status(status).json(payload);
  }

  private getErrorCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'VALIDATION_ERROR';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.SERVICE_UNAVAILABLE:
        return 'SERVICE_UNAVAILABLE';
      default:
        return status >= HttpStatus.INTERNAL_SERVER_ERROR ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR';
    }
  }
}
