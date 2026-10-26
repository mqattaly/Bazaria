import { describe, expect, it } from 'vitest';
import { currencyLabel, roleLabel, toPersianDigits } from './text';

describe('Persian text helpers', () => {
  it('converts Latin digits to Persian digits', () => {
    expect(toPersianDigits('1405/01/01')).toBe('۱۴۰۵/۰۱/۰۱');
    expect(toPersianDigits(42)).toBe('۴۲');
  });

  it('labels roles in Persian', () => {
    expect(roleLabel('manager')).toBe('مدیر شرکت');
    expect(roleLabel('sales_representative')).toBe('کارشناس فروش');
    expect(roleLabel('warehouse_user')).toBe('کارشناس انبار');
  });

  it('labels known currencies and falls back to the code', () => {
    expect(currencyLabel('IRR')).toBe('ریال');
    expect(currencyLabel('XYZ')).toBe('XYZ');
  });
});
