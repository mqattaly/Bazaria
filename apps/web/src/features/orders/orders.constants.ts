import type { OrderStatus } from '@bazariya/shared';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: 'پیش‌نویس',
  confirmed: 'تأییدشده',
  cancelled: 'لغوشده',
};

export const ORDER_STATUS_VARIANTS = {
  draft: 'warning',
  confirmed: 'success',
  cancelled: 'neutral',
} as const;

const orderTimeZone = 'Asia/Tehran';
const persianDateTime = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: orderTimeZone,
});
const gregorianTehranParts = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
  minute: '2-digit',
  month: '2-digit',
  second: '2-digit',
  timeZone: orderTimeZone,
  year: 'numeric',
});

export function formatOrderDate(value: string): string {
  return persianDateTime.format(new Date(value));
}

export function localDateTimeToIso(value: string): string | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return undefined;
  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);

  const requestedUtc = new Date(0);
  requestedUtc.setUTCFullYear(year, month - 1, day);
  requestedUtc.setUTCHours(hour, minute, 0, 0);
  if (
    requestedUtc.getUTCFullYear() !== year
    || requestedUtc.getUTCMonth() !== month - 1
    || requestedUtc.getUTCDate() !== day
    || requestedUtc.getUTCHours() !== hour
    || requestedUtc.getUTCMinutes() !== minute
  ) return undefined;

  const targetMilliseconds = requestedUtc.getTime();
  let instantMilliseconds = targetMilliseconds;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = Object.fromEntries(
      gregorianTehranParts.formatToParts(new Date(instantMilliseconds))
        .filter((part) => part.type !== 'literal')
        .map(({ type, value: partValue }) => [type, Number(partValue)]),
    );
    const renderedDate = new Date(0);
    renderedDate.setUTCFullYear(parts.year as number, (parts.month as number) - 1, parts.day as number);
    renderedDate.setUTCHours(parts.hour as number, parts.minute as number, parts.second as number, 0);
    const adjustment = targetMilliseconds - renderedDate.getTime();
    if (adjustment === 0) return new Date(instantMilliseconds).toISOString();
    instantMilliseconds += adjustment;
  }
  return undefined;
}
