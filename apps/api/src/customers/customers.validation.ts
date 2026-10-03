export function normalizePhone(value: string | null | undefined): string | null | undefined;
export function normalizePhone(value: unknown): unknown;
export function normalizePhone(value: unknown): unknown {
  if (typeof value !== 'string') return value;

  const digits = value
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660));
  const compact = digits.trim().replace(/[\s().-]/g, '');
  if (!compact) return null;
  if (compact.startsWith('+98')) return `0${compact.slice(3)}`;
  if (compact.startsWith('0098')) return `0${compact.slice(4)}`;
  return compact;
}

export function isValidCustomerPhone(value: string): boolean {
  return /^0\d{9,10}$/.test(value);
}

export function normalizeOptionalText(value: string | null | undefined): string | null | undefined {
  if (value === null || value === undefined) return value;
  const trimmed = value.trim();
  return trimmed || null;
}

export function normalizeEmail(value: string | null | undefined): string | null | undefined {
  if (value === null || value === undefined) return value;
  const normalized = value.trim().toLocaleLowerCase('en-US');
  return normalized || null;
}
