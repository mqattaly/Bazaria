import { HttpStatus } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { ApiException } from './api.exception.js';

function collectDetails(errors: ValidationError[], parent = ''): Array<{ field: string; message: string }> {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const ownDetails = Object.entries(error.constraints ?? {}).map(([constraint, message]) => ({
      field,
      message: constraint === 'whitelistValidation'
        ? `فیلد «${error.property}» مجاز نیست.`
        : message,
    }));
    return [...ownDetails, ...collectDetails(error.children ?? [], field)];
  });
}

export function createValidationException(errors: ValidationError[]): ApiException {
  return new ApiException(
    HttpStatus.BAD_REQUEST,
    'VALIDATION_ERROR',
    'اطلاعات واردشده معتبر نیست.',
    collectDetails(errors),
  );
}
