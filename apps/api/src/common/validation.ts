import { ValidationPipe } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import type { ApiErrorDetail } from '@bazaria/shared';
import { AppError } from './errors';

function flatten(
  errors: ValidationError[],
  prefix = '',
): ApiErrorDetail[] {
  const details: ApiErrorDetail[] = [];
  for (const error of errors) {
    const field = prefix ? `${prefix}.${error.property}` : error.property;
    if (error.constraints) {
      for (const message of Object.values(error.constraints)) {
        details.push({ field, code: 'INVALID_FIELD', message });
      }
    }
    if (error.children && error.children.length > 0) {
      details.push(...flatten(error.children, field));
    }
  }
  return details;
}

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    stopAtFirstError: false,
    exceptionFactory: (errors: ValidationError[]) =>
      new AppError('VALIDATION_ERROR', { details: flatten(errors) }),
  });
}
