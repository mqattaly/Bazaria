import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSession } from '../session/SessionContext';
import { Layout } from '../components/Layout';
import { Alert, Button, Card, Spinner } from '../components/ui';
import { SubscriptionNotice } from '../components/SubscriptionNotice';
import { StoreForm } from '../components/StoreForm';
import { api, ApiError, type CompanyView, type StoreInput } from '../lib/api';
import { toPersianDigits } from '../lib/text';

export function StoreCreatePage(): JSX.Element {
  const { activeCompany, refresh } = useSession();
  const navigate = useNavigate();

  const [company, setCompany] = useState<CompanyView | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<ApiError | null>(null);

  const load = useCallback(async () => {
    if (!activeCompany) return;
    setLoading(true);
    setLoadError(null);
    try {
      setCompany(await api.company(activeCompany.id));
    } catch (err) {
      const apiError =
        err instanceof ApiError
          ? err
          : new ApiError({
              status: 0,
              code: 'NETWORK_ERROR',
              message: 'دریافت اطلاعات شرکت انجام نشد.',
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
  }, [activeCompany, refresh]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(values: StoreInput): Promise<void> {
    if (!activeCompany) return;
    const created = await api.createStore(activeCompany.id, values);
    navigate(`/stores/${created.id}`, { replace: true, state: { created: true } });
  }

  if (loading) {
    return (
      <Layout>
        <Spinner />
      </Layout>
    );
  }

  if (loadError) {
    return (
      <Layout>
        <Card title="ثبت فروشگاه">
          <Alert requestId={loadError.requestId}>{loadError.message}</Alert>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void load()}>
              تلاش دوباره
            </Button>
            <Link to="/stores">
              <Button variant="ghost">بازگشت به فروشگاه‌ها</Button>
            </Link>
          </div>
        </Card>
      </Layout>
    );
  }

  if (!company) return <Layout>{null}</Layout>;

  const canCreate = company.permissions.includes('store.create');
  const readOnly = !company.subscription.writeAllowed;
  const capacityReached =
    company.storeUsage.limit > 0 &&
    company.storeUsage.active >= company.storeUsage.limit;

  return (
    <Layout>
      <div dir="rtl" className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-slate-900">ثبت فروشگاه جدید</h1>
        <Link to="/stores" className="text-sm text-brand-700 hover:underline">
          بازگشت به فروشگاه‌ها
        </Link>
      </div>

      <SubscriptionNotice subscription={company.subscription} />

      <Card
        title="اطلاعات فروشگاه"
        description="نام فروشگاه الزامی است؛ سایر فیلدها اختیاری‌اند و بعداً قابل ویرایش‌اند."
      >
        {!canCreate ? (
          <Alert tone="warning">
            ثبت فروشگاه برای نقش شما مجاز نیست. برای دسترسی با مدیر شرکت تماس
            بگیرید.
          </Alert>
        ) : readOnly ? (
          <Alert tone="warning">
            اشتراک شرکت در حالت فقط‌خواندنی است؛ ثبت فروشگاه تا تمدید اشتراک ممکن
            نیست.
          </Alert>
        ) : capacityReached ? (
          <Alert tone="warning" title="سقف فروشگاه‌ها تکمیل شده است">
            <p>
              ظرفیت فعال شرکت {toPersianDigits(company.storeUsage.limit)} فروشگاه است.
              برای ثبت فروشگاه جدید، یکی از فروشگاه‌ها را غیرفعال کنید یا با مدیر
              پلتفرم برای افزایش سقف تماس بگیرید.
            </p>
          </Alert>
        ) : (
          <StoreForm submitLabel="ثبت فروشگاه" onSubmit={create} />
        )}
      </Card>
    </Layout>
  );
}
