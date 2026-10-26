import { normalizeIranianMobile, maskMobile } from '../../src/auth/phone';

describe('Iranian mobile normalization', () => {
  it.each([
    ['09121234567', '+989121234567'],
    ['+989121234567', '+989121234567'],
    ['00989121234567', '+989121234567'],
    ['989121234567', '+989121234567'],
    ['9121234567', '+989121234567'],
    ['۰۹۱۲۱۲۳۴۵۶۷', '+989121234567'],
    ['٠٩١٢١٢٣٤٥٦٧', '+989121234567'],
    ['0912 123 4567', '+989121234567'],
    ['0912-123-4567', '+989121234567'],
    ['  09121234567  ', '+989121234567'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeIranianMobile(input)).toBe(expected);
  });

  it.each([
    '',
    '12345',
    '08121234567',
    '0912123456',
    '091212345678',
    '+9812123456789',
    'mobile-09121234567',
    '۰۹۱۲۱۲۳',
  ])('rejects %s', (input) => {
    expect(normalizeIranianMobile(input)).toBeNull();
  });

  it('masks a mobile for logs', () => {
    expect(maskMobile('+989121234567')).toBe('+98912***4567');
  });
});
