import {
  validatePassword,
  assertPasswordPolicy,
  PASSWORD_MIN_LENGTH,
} from '../../src/auth/password-policy';
import { AppError } from '../../src/common/errors';

describe('Password policy', () => {
  it('accepts a sufficiently long password with letters and digits', () => {
    expect(validatePassword('StrongPass12345')).toEqual([]);
  });

  it('rejects short passwords', () => {
    const violations = validatePassword('Aa1short');
    expect(violations.map((violation) => violation.code)).toContain(
      'PASSWORD_TOO_SHORT',
    );
    expect('Aa1short'.length).toBeLessThan(PASSWORD_MIN_LENGTH);
  });

  it('requires both letters and digits', () => {
    const violations = validatePassword('onlylettershere');
    expect(violations.map((violation) => violation.code)).toContain(
      'PASSWORD_NEEDS_LETTER_AND_DIGIT',
    );
  });

  it('rejects common passwords', () => {
    const violations = validatePassword('password123');
    expect(violations.map((violation) => violation.code)).toContain(
      'PASSWORD_TOO_COMMON',
    );
  });

  it('rejects a password containing the account mobile number', () => {
    const violations = validatePassword('Safe09121234567Pass', '+989121234567');
    expect(violations.map((violation) => violation.code)).toContain(
      'PASSWORD_CONTAINS_MOBILE',
    );
  });

  it('throws a structured application error', () => {
    try {
      assertPasswordPolicy('12345');
      throw new Error('expected to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const appError = error as AppError;
      expect(appError.code).toBe('PASSWORD_POLICY_VIOLATION');
      expect(appError.status).toBe(422);
      expect(appError.details?.length).toBeGreaterThan(0);
    }
  });
});
