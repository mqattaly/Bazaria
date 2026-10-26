const TEHRAN = 'Asia/Tehran';

const dateFormatter = new Intl.DateTimeFormat('fa-IR', {
  calendar: 'persian',
  timeZone: 'UTC',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('fa-IR', {
  calendar: 'persian',
  timeZone: TEHRAN,
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Gregorian ISO date -> Persian (Jalali) date. Date-only values are interpreted
 * as calendar dates (UTC), timestamps are rendered in Asia/Tehran.
 */
export function formatJalaliDate(value?: string | null): string {
  if (!value) return '—';
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = dateOnly ? new Date(`${value}T00:00:00Z`) : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return dateOnly
    ? new Intl.DateTimeFormat('fa-IR', {
        calendar: 'persian',
        timeZone: 'UTC',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(date)
    : dateTimeFormatter.format(date);
}

export function formatJalaliDateTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return dateTimeFormatter.format(date);
}

export { dateFormatter };
