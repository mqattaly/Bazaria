import { AppError } from './errors';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/** Rejects malformed identifiers as not-found, never as a database error. */
export function assertUuid(value: string): void {
  if (!isUuid(value)) {
    throw new AppError('RESOURCE_NOT_FOUND');
  }
}
