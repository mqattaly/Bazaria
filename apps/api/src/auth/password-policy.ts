import { AppError } from '../common/errors';
import { ERROR_MESSAGES_FA } from '@bazaria/shared';

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

/**
 * Small local deny-list of very common passwords. This is a baseline, not a
 * substitute for a full breach-corpus check (documented as a future item).
 */
const COMMON_PASSWORDS = new Set([
  '1234567890',
  '12345678',
  '123456789',
  'password',
  'password1',
  'password123',
  'qwerty12345',
  'qwertyuiop',
  'iloveyou1',
  'admin12345',
  'welcome123',
  'letmein123',
  '1111111111',
  '0000000000',
  'abcd123456',
  'p@ssw0rd',
  'passw0rd123',
]);

export interface PasswordViolation {
  code: string;
  message: string;
}

export function validatePassword(
  password: string,
  mobile?: string,
): PasswordViolation[] {
  const violations: PasswordViolation[] = [];

  if (typeof password !== 'string') {
    return [{ code: 'PASSWORD_REQUIRED', message: 'رمز عبور الزامی است.' }];
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    violations.push({
      code: 'PASSWORD_TOO_SHORT',
      message: `رمز عبور باید حداقل ${PASSWORD_MIN_LENGTH} نویسه باشد.`,
    });
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    violations.push({
      code: 'PASSWORD_TOO_LONG',
      message: `رمز عبور نباید بیش از ${PASSWORD_MAX_LENGTH} نویسه باشد.`,
    });
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    violations.push({
      code: 'PASSWORD_NEEDS_LETTER_AND_DIGIT',
      message: 'رمز عبور باید شامل حرف و رقم باشد.',
    });
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    violations.push({
      code: 'PASSWORD_TOO_COMMON',
      message: 'این رمز عبور رایج است و قابل استفاده نیست.',
    });
  }
  if (mobile) {
    const national = mobile.replace(/^\+98/, '0');
    if (password.includes(mobile) || password.includes(national)) {
      violations.push({
        code: 'PASSWORD_CONTAINS_MOBILE',
        message: 'رمز عبور نباید شامل شماره موبایل باشد.',
      });
    }
  }

  return violations;
}

export function assertPasswordPolicy(password: string, mobile?: string): void {
  const violations = validatePassword(password, mobile);
  if (violations.length > 0) {
    throw new AppError('PASSWORD_POLICY_VIOLATION', {
      message: ERROR_MESSAGES_FA.PASSWORD_POLICY_VIOLATION,
      details: violations,
    });
  }
}
