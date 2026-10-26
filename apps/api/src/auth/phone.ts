const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

function toLatinDigits(input: string): string {
  let result = '';
  for (const char of input) {
    const persianIndex = PERSIAN_DIGITS.indexOf(char);
    if (persianIndex >= 0) {
      result += String(persianIndex);
      continue;
    }
    const arabicIndex = ARABIC_DIGITS.indexOf(char);
    if (arabicIndex >= 0) {
      result += String(arabicIndex);
      continue;
    }
    result += char;
  }
  return result;
}

/**
 * Normalizes an Iranian mobile number to E.164 form (+989xxxxxxxxx).
 * Accepted inputs: 09xxxxxxxxx, 9xxxxxxxxx, +989xxxxxxxxx, 00989xxxxxxxxx,
 * with spaces/dashes and Persian or Arabic digits.
 * Returns null when the value is not a valid Iranian mobile number.
 */
export function normalizeIranianMobile(input: string): string | null {
  if (typeof input !== 'string') return null;
  const compact = toLatinDigits(input).replace(/[\s\-()]/g, '');
  if (!/^(\+?98|0098|0)?9\d{9}$/.test(compact)) return null;

  let national: string;
  if (compact.startsWith('+98')) {
    national = compact.slice(3);
  } else if (compact.startsWith('0098')) {
    national = compact.slice(4);
  } else if (compact.length === 12 && compact.startsWith('98')) {
    national = compact.slice(2);
  } else if (compact.startsWith('0')) {
    national = compact.slice(1);
  } else {
    national = compact;
  }

  if (!/^9\d{9}$/.test(national)) return null;
  return `+98${national}`;
}

/** Masks a mobile for logs: +989121234567 -> +98912***4567 */
export function maskMobile(mobile: string): string {
  if (mobile.length < 9) return '***';
  return `${mobile.slice(0, 6)}***${mobile.slice(-4)}`;
}
