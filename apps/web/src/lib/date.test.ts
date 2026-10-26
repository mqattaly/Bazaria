import { describe, expect, it } from 'vitest';
import { formatJalaliDate, formatJalaliDateTime } from './date';
import { applyDocumentDirection } from './document';

describe('Jalali date utilities', () => {
  it('converts a Gregorian date to the Persian calendar', () => {
    const formatted = formatJalaliDate('2026-03-21');
    expect(formatted).toContain('فروردین');
    expect(formatted).toContain('۱۴۰۵');
    expect(formatted).not.toContain('2026');
  });

  it('keeps date-only values stable regardless of timezone', () => {
    expect(formatJalaliDate('2026-03-21')).toBe(formatJalaliDate('2026-03-21'));
  });

  it('renders timestamps with Tehran time and Persian digits', () => {
    const formatted = formatJalaliDateTime('2026-03-21T20:30:00.000Z');
    expect(formatted).toContain('۱۴۰۵');
    expect(formatted).toMatch(/[۰-۹]/);
  });

  it('returns a placeholder for empty or invalid values', () => {
    expect(formatJalaliDate(null)).toBe('—');
    expect(formatJalaliDate('')).toBe('—');
    expect(formatJalaliDate('not-a-date')).toBe('—');
  });
});

describe('document direction', () => {
  it('sets the page to Persian RTL', () => {
    applyDocumentDirection();
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    expect(document.documentElement.getAttribute('lang')).toBe('fa');
  });
});
