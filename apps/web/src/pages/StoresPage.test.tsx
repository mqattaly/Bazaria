import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { CompanyDetail, StoreView } from '@bazaria/shared';
import { StoresPage } from './StoresPage';
import { SessionProvider } from '../session/SessionContext';
import { ApiError, type CompanyView } from '../lib/api';

const meMock = vi.fn();
const companiesMock = vi.fn();
const companyMock = vi.fn();
const storesMock = vi.fn();

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      me: () => meMock(),
      myCompanies: () => companiesMock(),
      company: (...args: unknown[]) => companyMock(...args),
      stores: (...args: unknown[]) => storesMock(...args),
    },
  };
});

const COMPANY_ID = '11111111-1111-4111-8111-111111111111';
const MANAGER_PERMISSIONS = [
  'company.view',
  'company.settings.manage',
  'membership.view',
  'membership.manage',
  'license.view',
  'store.view',
  'store.create',
  'store.update',
  'store.deactivate',
];

function myCompany(permissions: string[] = MANAGER_PERMISSIONS) {
  return {
    id: COMPANY_ID,
    name: 'شرکت آزمون',
    code: 'TEST-1',
    status: 'active',
    currency: 'IRR',
    role: 'manager',
    membershipId: 'membership-1',
    permissions,
  };
}

function companyView(overrides: Partial<CompanyView> = {}): CompanyView {
  return {
    id: COMPANY_ID,
    name: 'شرکت آزمون',
    code: 'TEST-1',
    status: 'active',
    currency: 'IRR',
    role: 'manager',
    permissions: MANAGER_PERMISSIONS,
    subscription: {
      state: 'active',
      validUntil: null,
      graceEndsAt: null,
      writeAllowed: true,
      gracePeriodDays: 7,
    },
    storeUsage: { active: 1, limit: 3 },
    ...overrides,
  } satisfies CompanyView;
}

function store(overrides: Partial<StoreView> = {}): StoreView {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'فروشگاه مرکزی',
    contactName: 'رضا محمدی',
    contactMobile: '+989121234567',
    address: 'تهران، خیابان نمونه',
    note: null,
    status: 'active',
    createdByUserId: null,
    updatedByUserId: null,
    createdAt: '2026-10-01T08:00:00.000Z',
    updatedAt: '2026-10-01T08:00:00.000Z',
    ...overrides,
  };
}

function page(items: StoreView[], meta: Partial<Record<string, number>> = {}) {
  return {
    data: items,
    meta: {
      page: 1,
      pageSize: 20,
      totalItems: items.length,
      totalPages: items.length > 0 ? 1 : 0,
      ...meta,
    },
  };
}

function renderStores(company: CompanyView = companyView()) {
  companyMock.mockResolvedValue(company);
  localStorage.setItem('bz.activeCompanyId', COMPANY_ID);
  return render(
    <MemoryRouter initialEntries={['/stores']}>
      <SessionProvider>
        <StoresPage />
      </SessionProvider>
    </MemoryRouter>,
  );
}

describe('Stores page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    meMock.mockResolvedValue({
      id: 'user-1',
      mobile: '+989120000001',
      fullName: 'مدیر آزمون',
      status: 'active',
    });
    companiesMock.mockResolvedValue([myCompany()]);
    companyMock.mockResolvedValue(companyView());
    storesMock.mockResolvedValue(page([store()]));
  });

  it('shows a loading state before the list arrives', async () => {
    storesMock.mockReturnValue(new Promise(() => undefined));
    renderStores();
    expect(await screen.findByText('در حال بارگذاری…')).toBeInTheDocument();
  });

  it('renders the store list, count and permitted actions in RTL', async () => {
    storesMock.mockResolvedValue(
      page([
        store(),
        store({
          id: '33333333-3333-4333-8333-333333333333',
          name: 'فروشگاه شعبه شرق',
          contactName: null,
          contactMobile: null,
          address: null,
          status: 'inactive',
        }),
      ]),
    );
    const { container } = renderStores();

    expect(await screen.findByText('فروشگاه مرکزی')).toBeInTheDocument();
    expect(screen.getByText('فروشگاه شعبه شرق')).toBeInTheDocument();
    expect(screen.getByText(/۲ فروشگاه/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'افزودن فروشگاه' })).toBeEnabled();
    expect(screen.getAllByText('مشاهده')).toHaveLength(2);
    expect(screen.getAllByText('ویرایش')).toHaveLength(2);
    const table = within(screen.getByRole('table'));
    expect(table.getByText('فعال')).toBeInTheDocument();
    expect(table.getByText('غیرفعال')).toBeInTheDocument();

    const pageRoot = container.querySelector('[dir="rtl"]');
    expect(pageRoot).not.toBeNull();
    expect(container.querySelector('.overflow-x-auto')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'فروشگاه‌ها' })).toHaveAttribute(
      'href',
      '/stores',
    );
  });

  it('shows an empty state when the company has no stores', async () => {
    storesMock.mockResolvedValue(page([]));
    renderStores();

    expect(
      await screen.findByText('هنوز فروشگاهی برای این شرکت ثبت نشده است.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows a recoverable error with a retry action', async () => {
    storesMock.mockRejectedValueOnce(
      new ApiError({
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'خطای پیش‌بینی‌نشده‌ای رخ داد.',
        requestId: 'req-1',
      }),
    );
    renderStores();

    expect(await screen.findByText('خطای پیش‌بینی‌نشده‌ای رخ داد.')).toBeInTheDocument();
    const retry = screen.getByRole('button', { name: 'تلاش دوباره' });
    storesMock.mockResolvedValue(page([store()]));
    await userEvent.click(retry);
    expect(await screen.findByText('فروشگاه مرکزی')).toBeInTheDocument();
  });

  it('sends search and status filters to the server and resets the page', async () => {
    storesMock.mockResolvedValue(page([store()], { totalItems: 45, totalPages: 3 }));
    renderStores();

    await screen.findByText('فروشگاه مرکزی');
    await userEvent.click(screen.getByRole('button', { name: 'صفحه بعد' }));
    await waitFor(() =>
      expect(storesMock).toHaveBeenLastCalledWith(COMPANY_ID, expect.objectContaining({ page: 2 })),
    );

    await userEvent.type(screen.getByLabelText('جست‌وجو'), 'آبی');
    await userEvent.click(screen.getByRole('button', { name: 'جست‌وجو' }));
    await waitFor(() =>
      expect(storesMock).toHaveBeenLastCalledWith(
        COMPANY_ID,
        expect.objectContaining({ page: 1, q: 'آبی' }),
      ),
    );

    await userEvent.selectOptions(screen.getByLabelText('وضعیت'), 'inactive');
    await waitFor(() =>
      expect(storesMock).toHaveBeenLastCalledWith(
        COMPANY_ID,
        expect.objectContaining({ status: 'inactive' }),
      ),
    );

    await userEvent.click(screen.getByRole('button', { name: 'پاک‌سازی' }));
    await waitFor(() =>
      expect(storesMock).toHaveBeenLastCalledWith(
        COMPANY_ID,
        expect.objectContaining({ page: 1 }),
      ),
    );
    const lastQuery = storesMock.mock.calls.at(-1)?.[1] as Record<string, unknown>;
    expect(lastQuery.q).toBeUndefined();
    expect(lastQuery.status).toBeUndefined();
  });

  it('hides create and edit actions for users without store permissions', async () => {
    companiesMock.mockResolvedValue([myCompany(['store.view'])]);
    renderStores(companyView({ permissions: ['store.view'] }));

    expect(await screen.findByText('فروشگاه مرکزی')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'افزودن فروشگاه' })).not.toBeInTheDocument();
    expect(screen.queryByText('ویرایش')).not.toBeInTheDocument();
    expect(screen.getAllByText('مشاهده')).toHaveLength(1);
  });

  it('blocks every write action and shows a clear notice in read-only mode', async () => {
    renderStores(
      companyView({
        subscription: {
          state: 'read_only',
          validUntil: '2026-09-01',
          graceEndsAt: '2026-09-08T00:00:00.000Z',
          writeAllowed: false,
          gracePeriodDays: 7,
        },
      }),
    );

    expect(
      await screen.findByText('شرکت در حالت فقط‌خواندنی است'),
    ).toBeInTheDocument();
    expect(screen.getByText(/ثبت و تغییر داده‌ها تا تمدید اشتراک ممکن نیست/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'افزودن فروشگاه' })).toBeDisabled();

    const editLabel = screen.getByText('ویرایش');
    expect(editLabel.tagName).not.toBe('A');
    expect(editLabel).toHaveAttribute('title', 'در حالت فقط‌خواندنی امکان ویرایش نیست.');
  });

  it('warns during the grace period but keeps writes enabled', async () => {
    renderStores(
      companyView({
        subscription: {
          state: 'grace_period',
          validUntil: '2026-10-01',
          graceEndsAt: '2026-10-09T00:00:00.000Z',
          writeAllowed: true,
          gracePeriodDays: 7,
        },
      }),
    );

    expect(await screen.findByText('مهلت ارفاقی اشتراک شرکت')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'افزودن فروشگاه' })).toBeEnabled();
  });

  it('disables creation at the licensed store cap', async () => {
    renderStores(companyView({ storeUsage: { active: 3, limit: 3 } }));

    expect(await screen.findByText('سقف فروشگاه‌ها تکمیل شده است')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'افزودن فروشگاه' })).toBeDisabled();
  });
});
