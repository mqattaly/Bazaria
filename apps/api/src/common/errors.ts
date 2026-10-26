import { ERROR_MESSAGES_FA, type ApiErrorDetail, type ErrorCode } from '@bazaria/shared';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 422,
  MALFORMED_REQUEST: 400,
  COMPANY_CONTEXT_REQUIRED: 400,
  AUTH_REQUIRED: 401,
  AUTH_INVALID_CREDENTIALS: 401,
  AUTH_ACCOUNT_LOCKED: 423,
  COMPANY_ACCESS_DENIED: 403,
  PERMISSION_DENIED: 403,
  SELF_MANAGEMENT_FORBIDDEN: 403,
  RESOURCE_NOT_FOUND: 404,
  STATE_CONFLICT: 409,
  MEMBERSHIP_EXISTS: 409,
  LAST_MANAGER_REQUIRED: 409,
  INVALID_RESET_TOKEN: 400,
  PASSWORD_POLICY_VIOLATION: 422,
  COMPANY_CODE_TAKEN: 409,
  LICENSE_INACTIVE: 403,
  LICENSE_STORE_LIMIT_REACHED: 403,
  COMPANY_SUBSCRIPTION_READ_ONLY: 403,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

const RETRYABLE: ReadonlySet<ErrorCode> = new Set<ErrorCode>([
  'AUTH_ACCOUNT_LOCKED',
  'RATE_LIMITED',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_ERROR',
]);

export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: ApiErrorDetail[];
  readonly meta?: Record<string, unknown>;
  readonly retryable: boolean;

  constructor(
    code: ErrorCode,
    options: {
      message?: string;
      details?: ApiErrorDetail[];
      meta?: Record<string, unknown>;
    } = {},
  ) {
    super(options.message ?? ERROR_MESSAGES_FA[code]);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = options.details;
    this.meta = options.meta;
    this.retryable = RETRYABLE.has(code);
  }
}

export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const pgError = error as { code?: string; constraint?: string };
  if (pgError.code !== '23505') return false;
  return constraint ? pgError.constraint === constraint : true;
}
