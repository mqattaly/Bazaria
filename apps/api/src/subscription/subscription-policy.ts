import type { SubscriptionSnapshot, SubscriptionState } from '@bazaria/shared';

/**
 * Subscription state is derived, never stored: `company_entitlements.valid_until`
 * is the source of truth. A date-only value is interpreted as a UTC calendar
 * date and stays valid through the end of that day (00:00 UTC of the next day).
 * The grace period starts at that boundary. Times are UTC; the UI renders them
 * in the user's local (Persian) calendar.
 */

export const DEFAULT_GRACE_DAYS = 7;
export const MAX_GRACE_DAYS = 3650;

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface SubscriptionInput {
  companyStatus: string;
  licenseStatus: string;
  validUntil: string | null;
  graceDays: number;
}

/** Parses and validates SUBSCRIPTION_GRACE_DAYS; zero disables the grace period. */
export function parseGraceDays(raw: string | undefined | null): number {
  if (raw === undefined || raw === null || raw.trim() === '') {
    return DEFAULT_GRACE_DAYS;
  }
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error('SUBSCRIPTION_GRACE_DAYS must be a non-negative integer');
  }
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value) || value > MAX_GRACE_DAYS) {
    throw new Error(
      `SUBSCRIPTION_GRACE_DAYS must be between 0 and ${MAX_GRACE_DAYS}`,
    );
  }
  return value;
}

function parseUtcDateOnly(value: string): Date | null {
  const match = DATE_ONLY.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

/** First instant after the stored date (exclusive end of the UTC day). */
export function endOfUtcDate(value: string): Date | null {
  const date = parseUtcDateOnly(value);
  if (!date) return null;
  return new Date(date.getTime() + DAY_MS);
}

export function toUtcDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDaysToUtcDate(value: string, days: number): string | null {
  const date = parseUtcDateOnly(value);
  if (!date) return null;
  return toUtcDateOnly(new Date(date.getTime() + days * DAY_MS));
}

function suspendedSnapshot(
  validUntil: string | null,
  graceDays: number,
): SubscriptionSnapshot {
  return {
    state: 'suspended',
    validUntil,
    graceEndsAt: null,
    writeAllowed: false,
    gracePeriodDays: graceDays,
  };
}

export function evaluateSubscription(
  input: SubscriptionInput,
  now: Date,
): SubscriptionSnapshot {
  if (!Number.isInteger(input.graceDays) || input.graceDays < 0) {
    throw new Error('graceDays must be a non-negative integer');
  }

  if (input.companyStatus !== 'active' || input.licenseStatus !== 'active') {
    return suspendedSnapshot(input.validUntil, input.graceDays);
  }

  if (input.validUntil === null) {
    return {
      state: 'active',
      validUntil: null,
      graceEndsAt: null,
      writeAllowed: true,
      gracePeriodDays: input.graceDays,
    };
  }

  const validityEnd = endOfUtcDate(input.validUntil);
  if (!validityEnd) {
    // Corrupt/unexpected dates fail closed: reads remain possible, writes do not.
    return {
      state: 'read_only',
      validUntil: input.validUntil,
      graceEndsAt: null,
      writeAllowed: false,
      gracePeriodDays: input.graceDays,
    };
  }

  const graceEndsAt = new Date(
    validityEnd.getTime() + input.graceDays * DAY_MS,
  );

  let state: SubscriptionState;
  if (now.getTime() < validityEnd.getTime()) {
    state = 'active';
  } else if (now.getTime() < graceEndsAt.getTime()) {
    state = 'grace_period';
  } else {
    state = 'read_only';
  }

  return {
    state,
    validUntil: input.validUntil,
    graceEndsAt: graceEndsAt.toISOString(),
    writeAllowed: state === 'active' || state === 'grace_period',
    gracePeriodDays: input.graceDays,
  };
}
