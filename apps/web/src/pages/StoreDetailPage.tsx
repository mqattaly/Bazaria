import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import type { StoreView } from '@bazaria/shared';
import { useSession } from '../session/SessionContext';
import { Layout } from '../components/Layout';
import { Alert, Badge, Button, Card, Spinner, Value } from '../components/ui';
import { SubscriptionNotice } from '../components/SubscriptionNotice';
import { StoreForm } from '../components/StoreForm';
import { api, ApiError, type CompanyView, type StoreInput } from '../lib/api';
import { formatJalaliDateTime } from '../lib/date';
import { storeStatusLabel, toPersianDigits } from '../lib/text';

interface Feedback {
  tone: 'success' | 'error';
  message: string;
  requestId?: string;
}

export function StoreDetailPage(): JSX.Element {
  const { storeId } = useParams<{ storeId: string }>();
  const location = useLocation();
  const { activeCompany, refresh } = useSession();

  const [company, setCompany] = useState<CompanyView | null>(null);
  const [store, setStore] = useState<StoreView | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [toggleBusy, setToggleBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(
    (location.state as { created?: boolean } | null)?.created
      ? { tone: 'success', message: 'فروشگاه با موفقیت ثبت شد.' }
      : null,
  );

  const load = useCallback(async () => {
    if (!activeCompany || !storeId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [companyView, storeView] = await Promise.all([
        api.company(activeCompany.id),
        api.store(activeCompany.id, storeId),
      ]);
      setCompany(companyView);
      setStore(storeView);
    } catch (err) {
      const apiError =
        err instanceof ApiError
          ? err
          : new ApiError({
              status: 0,
              code: 'NETWORK_ERROR',
              message: 'دریافت اطلاعات فروشگاه انجام نشد.',
              retryable: true,
            });
      if (apiError.status === 401) {
        await refresh();
        return;
      }
      setLoadError(apiError);
    } finally {
      setLoading(false);
    }
  }, [activeCompany, refresh, storeId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(values: StoreInput): Promise<void> {
    if (!activeCompany || !storeId) return;
    const updated = await api.updateStore(activeCompany.id, storeId, values);
    setStore(updated);
    setFeedback({ tone: 'success', message: 'تغییرات فروشگاه ذخیره شد.' });
  }

  async function toggleStatus(): Promise<void> {
    if (!activeCompany || !storeId || !store || toggleBusy) return;
    setToggleBusy(true);
    setFeedback(null);
    try {
      const updated = await api.updateStoreStatus(
        activeCompany.id,
        storeId,
        store.status === 'active' ? 'inactive' : 'active',
      );
      setStore(updated);
      setCompany(await api.company(activeCompany.id));
      setFeedback({
        tone: 'success',
        message:
          updated.status === 'active'
            ? 'فروشگاه فعال شد.'
            : 'فروشگاه غیرفعال شد؛ داده‌های آن حذف نشده است.',
      });
    } catch (err) {
      const apiError =
        err instanceof ApiError
          ? err
          : new ApiError({
              status: 0,
              code: 'NETWORK_ERROR',
              message: 'تغییر وضعیت فروشگاه انجام نشد.',
              retryable: true,
            });
      setFeedback({
        tone: 'error',
        message: apiError.message,
        requestId: apiError.requestId,
      });
    } finally {
      setToggleBusy(false);
    }
  }

  if (loading) {
    return (
      <Layout>
        <Spinner />
      </Layout>
    );
  }

  if (loadError || !store || !company) {
    const notFound = loadError?.status === 404;
    return (
      <Layout>
        <Card title={notFound ? 'فروشگاه یافت نشد' : 'دسترسی به فروشگاه ممکن نیست'}>
          <Alert requestId={loadError?.requestId}>
            {notFound
              ? 'این فروشگاه در محدوده شرکت فعال شما وجود ندارد یا حذف شده است.'
              : (loadError?.message ?? 'دریافت اطلاعات فروشگاه انجام نشد.')}
          </Alert>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/stores">
              <Button variant="secondary">بازگشت به فهرست فروشگاه‌ها</Button>
            </Link>
            {!notFound ? (
              <Button variant="ghost" onClick={() => void load()}>
                تلاش دوباره
              </Button>
            ) : null}
          </div>
        </Card>
      </Layout>
    );
  }

  const canUpdate = company.permissions.includes('store.update');
  const canDeactivate = company.permissions.includes('store.deactivate');
  const readOnly = !company.subscription.writeAllowed;

  return (
    <Layout>
      <div dir="rtl" className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/stores" className="text-xs text-brand-700 hover:underline">
            بازگشت به فروشگاه‌ها
          </Link>
          <h1 className="mt-1 text-xl font-bold text-slate-900">{store.name}</h1>
          <p className="mt-1 text-xs text-slate-500">
            شناسه فروشگاه: <span dir="ltr">{store.id}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={store.status === 'active' ? 'success' : 'neutral'}>
            {storeStatusLabel(store.status)}
          </Badge>
          {canDeactivate ? (
            <Button
              variant={store.status === 'active' ? 'danger' : 'secondary'}
              loading={toggleBusy}
              disabled={readOnly}
              title={
                readOnly ? 'اشتراک شرکت در حالت فقط‌خواندنی است.' : undefined
              }
              onClick={() => void toggleStatus()}
            >
              {store.status === 'active' ? 'غیرفعال کردن' : 'فعال کردن'}
            </Button>
          ) : null}
        </div>
      </div>

      <SubscriptionNotice subscription={company.subscription} />

      {feedback ? (
        <div className="mb-4">
          <Alert tone={feedback.tone} requestId={feedback.requestId}>
            {feedback.message}
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="اطلاعات فروشگاه">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500">نام</dt>
              <Value>{store.name}</Value>
            </div>
            <div>
              <dt className="text-xs text-slate-500">نام مسئول</dt>
              <Value>{store.contactName ?? '—'}</Value>
            </div>
            <div>
              <dt className="text-xs text-slate-500">موبایل تماس</dt>
              <Value>
                <span dir="ltr">{store.contactMobile ?? '—'}</span>
              </Value>
            </div>
            <div>
              <dt className="text-xs text-slate-500">نشانی</dt>
              <Value>{store.address ?? '—'}</Value>
            </div>
            <div>
              <dt className="text-xs text-slate-500">یادداشت</dt>
              <Value>{store.note ?? '—'}</Value>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
              <div>
                <dt className="text-xs text-slate-500">تاریخ ثبت</dt>
                <Value>{formatJalaliDateTime(store.createdAt)}</Value>
              </div>
              <div>
                <dt className="text-xs text-slate-500">آخرین ویرایش</dt>
                <Value>{formatJalaliDateTime(store.updatedAt)}</Value>
              </div>
            </div>
          </dl>
        </Card>

        <Card
          title="ویرایش اطلاعات"
          description="تغییرات مهم فروشگاه برای پیگیری در سوابق ممیزی ثبت می‌شود."
        >
          {!canUpdate ? (
            <p className="text-sm text-slate-500">
              ویرایش فروشگاه برای نقش شما مجاز نیست.
            </p>
          ) : (
            <>
              {readOnly ? (
                <div className="mb-3">
                  <Alert tone="warning">
                    اشتراک شرکت در حالت فقط‌خواندنی است؛ فرم ویرایش غیرفعال شده
                    است و تغییرات تا تمدید اشتراک ذخیره نمی‌شود.
                  </Alert>
                </div>
              ) : null}
              <StoreForm
                initial={{
                  name: store.name,
                  contactName: store.contactName ?? '',
                  contactMobile: store.contactMobile ?? '',
                  address: store.address ?? '',
                  note: store.note ?? '',
                }}
                submitLabel="ذخیره تغییرات"
                onSubmit={save}
                disabled={readOnly}
                disabledReason="پس از پایان مهلت ارفاقی، ثبت تغییرات تا تمدید اشتراک ممکن نیست."
              />
            </>
          )}
        </Card>
      </div>

      <p className="mt-4 text-xs text-slate-400">
        فروشگاه‌ها حذف فیزیکی نمی‌شوند؛ برای کنار گذاشتن یک شعبه، آن را غیرفعال کنید
        تا سوابق آن دست‌نخورده بماند. ظرفیت مجاز شرکت:{' '}
        {company.storeUsage.limit > 0
          ? `${toPersianDigits(company.storeUsage.active)} از ${toPersianDigits(company.storeUsage.limit)} فعال`
          : 'نامشخص'}
      </p>
    </Layout>
  );
}
