import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { PageMeta, StoreStatus, StoreView } from '@bazaria/shared';
import { useSession } from '../session/SessionContext';
import { Layout } from '../components/Layout';
import { Alert, Badge, Button, Card, Spinner } from '../components/ui';
import { SubscriptionNotice } from '../components/SubscriptionNotice';
import { api, ApiError, type CompanyView } from '../lib/api';
import { formatJalaliDate } from '../lib/date';
import { storeStatusLabel, toPersianDigits } from '../lib/text';

const PAGE_SIZE = 20;

type StatusFilter = 'all' | StoreStatus;

function asApiError(error: unknown, fallback: string): ApiError {
  return error instanceof ApiError
    ? error
    : new ApiError({ status: 0, code: 'NETWORK_ERROR', message: fallback, retryable: true });
}

export function StoresPage(): JSX.Element {
  const { activeCompany, refresh } = useSession();
  const navigate = useNavigate();

  const [company, setCompany] = useState<CompanyView | null>(null);
  const [stores, setStores] = useState<StoreView[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    if (!activeCompany) return;
    setBusy(true);
    setError(null);
    try {
      const [companyView, list] = await Promise.all([
        api.company(activeCompany.id),
        api.stores(activeCompany.id, {
          page,
          pageSize: PAGE_SIZE,
          q: search || undefined,
          status: status === 'all' ? undefined : status,
          sort: '-createdAt',
        }),
      ]);
      setCompany(companyView);
      setStores(list.data);
      setMeta(list.meta);
    } catch (err) {
      const apiError = asApiError(err, 'دریافت فهرست فروشگاه‌ها انجام نشد.');
      if (apiError.status === 401) {
        await refresh();
        return;
      }
      setError(apiError);
    } finally {
      setBusy(false);
      setLoading(false);
    }
  }, [activeCompany, page, refresh, search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  function submitSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setPage(1);
    setSearch(searchDraft.trim());
  }

  function clearFilters(): void {
    setSearchDraft('');
    setSearch('');
    setStatus('all');
    setPage(1);
  }

  if (!activeCompany) return <Layout>{null}</Layout>;

  if (loading) {
    return (
      <Layout>
        <Spinner />
      </Layout>
    );
  }

  if (error && !company) {
    return (
      <Layout>
        <Card title="دسترسی به فروشگاه‌ها ممکن نیست">
          <Alert requestId={error.requestId}>{error.message}</Alert>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => void load()}>تلاش دوباره</Button>
            <Button variant="secondary" onClick={() => navigate('/companies')}>
              انتخاب شرکت دیگر
            </Button>
          </div>
        </Card>
      </Layout>
    );
  }

  if (!company) return <Layout>{null}</Layout>;

  const canView = company.permissions.includes('store.view');
  if (!canView) {
    return (
      <Layout>
        <Card title="فروشگاه‌ها">
          <Alert tone="warning">
            نمایش فروشگاه‌ها برای نقش شما مجاز نیست. برای دسترسی با مدیر شرکت تماس
            بگیرید.
          </Alert>
        </Card>
      </Layout>
    );
  }

  const readOnly = !company.subscription.writeAllowed;
  const canCreate = company.permissions.includes('store.create');
  const canUpdate = company.permissions.includes('store.update');
  const capacityReached =
    company.storeUsage.limit > 0 &&
    company.storeUsage.active >= company.storeUsage.limit;
  const hasFilters = search !== '' || status !== 'all';
  const totalPages = meta?.totalPages ?? 0;

  return (
    <Layout>
      <div dir="rtl" className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">فروشگاه‌ها</h1>
          <p className="mt-1 text-sm text-slate-500">
            مدیریت فروشگاه‌های شرکت {company.name}
            {meta ? (
              <>
                {' '}
                · {toPersianDigits(meta.totalItems)} فروشگاه
                {company.storeUsage.limit > 0 ? (
                  <>
                    {' '}
                    · ظرفیت فعال: {toPersianDigits(company.storeUsage.active)} از{' '}
                    {toPersianDigits(company.storeUsage.limit)}
                  </>
                ) : null}
              </>
            ) : null}
          </p>
        </div>
        {canCreate ? (
          <Button
            onClick={() => navigate('/stores/new')}
            disabled={readOnly || capacityReached}
            title={
              readOnly
                ? 'اشتراک شرکت در حالت فقط‌خواندنی است.'
                : capacityReached
                  ? 'سقف فروشگاه‌های مجاز شرکت تکمیل شده است.'
                  : undefined
            }
          >
            افزودن فروشگاه
          </Button>
        ) : null}
      </div>

      <SubscriptionNotice subscription={company.subscription} />

      {capacityReached && !readOnly ? (
        <div className="mb-4">
          <Alert tone="warning" title="سقف فروشگاه‌ها تکمیل شده است">
            <p>
              ظرفیت فعال شرکت {toPersianDigits(company.storeUsage.limit)} فروشگاه است.
              برای ثبت فروشگاه جدید، یکی از فروشگاه‌ها را غیرفعال کنید یا با مدیر
              پلتفرم برای افزایش سقف تماس بگیرید.
            </p>
          </Alert>
        </div>
      ) : null}

      <Card>
        <form
          onSubmit={submitSearch}
          className="grid gap-3 border-b border-slate-100 pb-4 sm:grid-cols-[1fr_auto_auto]"
          role="search"
        >
          <div>
            <label htmlFor="store-search">جست‌وجو</label>
            <input
              id="store-search"
              type="search"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="نام، نام مسئول، نشانی یا موبایل"
              disabled={busy}
            />
          </div>
          <div>
            <label htmlFor="store-status-filter">وضعیت</label>
            <select
              id="store-status-filter"
              value={status}
              disabled={busy}
              onChange={(event) => {
                setStatus(event.target.value as StatusFilter);
                setPage(1);
              }}
            >
              <option value="all">همه</option>
              <option value="active">فعال</option>
              <option value="inactive">غیرفعال</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <Button type="submit" variant="secondary" loading={busy && !loading}>
              جست‌وجو
            </Button>
            {hasFilters ? (
              <Button type="button" variant="ghost" onClick={clearFilters} disabled={busy}>
                پاک‌سازی
              </Button>
            ) : null}
          </div>
        </form>

        {error ? (
          <div className="pt-4">
            <Alert requestId={error.requestId}>
              <p>{error.message}</p>
              <Button className="mt-3" variant="secondary" onClick={() => void load()}>
                تلاش دوباره
              </Button>
            </Alert>
          </div>
        ) : null}

        {!error && stores.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500" role="status">
            {hasFilters ? (
              <>
                <p>فروشگاهی با این جست‌وجو یا فیلتر یافت نشد.</p>
                <Button className="mt-3" variant="secondary" onClick={clearFilters}>
                  پاک‌سازی فیلترها
                </Button>
              </>
            ) : (
              <>
                <p>هنوز فروشگاهی برای این شرکت ثبت نشده است.</p>
                {canCreate ? (
                  <p className="mt-2 text-xs text-slate-400">
                    با دکمه «افزودن فروشگاه» اولین فروشگاه را ثبت کنید.
                  </p>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {stores.length > 0 ? (
          <div className="overflow-x-auto pt-2">
            <table aria-busy={busy}>
              <thead>
                <tr>
                  <th>فروشگاه</th>
                  <th>مسئول</th>
                  <th className="hidden sm:table-cell">نشانی</th>
                  <th>وضعیت</th>
                  <th className="hidden md:table-cell">تاریخ ثبت</th>
                  <th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {stores.map((store) => (
                  <tr key={store.id}>
                    <td>
                      <Link
                        to={`/stores/${store.id}`}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {store.name}
                      </Link>
                    </td>
                    <td>
                      <span className="block text-sm text-slate-800">
                        {store.contactName ?? '—'}
                      </span>
                      {store.contactMobile ? (
                        <span dir="ltr" className="block text-xs text-slate-500">
                          {store.contactMobile}
                        </span>
                      ) : null}
                    </td>
                    <td className="hidden max-w-[16rem] truncate text-sm text-slate-600 sm:table-cell">
                      {store.address ?? '—'}
                    </td>
                    <td>
                      <Badge tone={store.status === 'active' ? 'success' : 'neutral'}>
                        {storeStatusLabel(store.status)}
                      </Badge>
                    </td>
                    <td className="hidden text-xs text-slate-500 md:table-cell">
                      {formatJalaliDate(store.createdAt.slice(0, 10))}
                    </td>
                    <td>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/stores/${store.id}`}
                          className="text-xs font-medium text-brand-700 hover:underline"
                        >
                          مشاهده
                        </Link>
                        {canUpdate ? (
                          readOnly ? (
                            <span
                              className="text-xs text-slate-400"
                              title="در حالت فقط‌خواندنی امکان ویرایش نیست."
                            >
                              ویرایش
                            </span>
                          ) : (
                            <Link
                              to={`/stores/${store.id}`}
                              className="text-xs text-slate-600 hover:underline"
                            >
                              ویرایش
                            </Link>
                          )
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {totalPages > 1 ? (
          <nav
            aria-label="صفحه‌بندی فروشگاه‌ها"
            className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm"
          >
            <span className="text-xs text-slate-500">
              صفحه {toPersianDigits(page)} از {toPersianDigits(totalPages)}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={busy || page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                صفحه قبل
              </Button>
              <Button
                variant="secondary"
                disabled={busy || page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                صفحه بعد
              </Button>
            </div>
          </nav>
        ) : null}
      </Card>
    </Layout>
  );
}
