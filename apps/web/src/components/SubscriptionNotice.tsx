import type { SubscriptionSnapshot } from '@bazaria/shared';
import { Alert } from './ui';
import { formatJalaliDate, formatJalaliDateTime } from '../lib/date';

/**
 * Server-computed subscription state, rendered once per write-capable page.
 * It is a notice only: the API rejects writes on its own.
 */
export function SubscriptionNotice({
  subscription,
}: {
  subscription: SubscriptionSnapshot;
}): JSX.Element | null {
  if (subscription.state === 'grace_period') {
    return (
      <div className="mb-4">
        <Alert tone="warning" title="مهلت ارفاقی اشتراک شرکت">
          <p>
            تاریخ اعتبار اشتراک شرکت پایان یافته است، اما تا{' '}
            <strong>{formatJalaliDateTime(subscription.graceEndsAt)}</strong> امکان
            ثبت و ویرایش اطلاعات وجود دارد. برای جلوگیری از قطع دسترسی، اشتراک را
            تمدید کنید.
          </p>
        </Alert>
      </div>
    );
  }

  if (subscription.state === 'read_only') {
    return (
      <div className="mb-4">
        <Alert tone="error" title="شرکت در حالت فقط‌خواندنی است">
          <p>
            مهلت ارفاقی اشتراک شرکت به پایان رسیده است. مشاهده اطلاعات ادامه دارد،
            اما ثبت و تغییر داده‌ها تا تمدید اشتراک ممکن نیست.
          </p>
          <p className="mt-1">
            برای تمدید با مدیر شرکت یا پشتیبانی بازاریا تماس بگیرید.
            {subscription.validUntil ? (
              <> آخرین روز اعتبار: {formatJalaliDate(subscription.validUntil)}</>
            ) : null}
          </p>
        </Alert>
      </div>
    );
  }

  if (subscription.state === 'suspended') {
    return (
      <div className="mb-4">
        <Alert tone="error" title="مجوز شرکت فعال نیست">
          <p>دسترسی به اطلاعات شرکت تا فعال‌سازی مجوز متوقف شده است.</p>
        </Alert>
      </div>
    );
  }

  return null;
}
