import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { StoreView } from '@bazaria/shared';
import { StoreDetailPage } from './StoreDetailPage';
import { SessionProvider } from '../session/SessionContext';
import { ApiError, type CompanyView } from '../lib/api';

const meMock = vi.fn();
const companiesMock = vi.fn();
const companyMock = vi.fn();
const storeMock = vi.fn();
const updateStoreMock = vi.fn();
const updateStatusMock = vi.fn();

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      me: () => meMock(),
      myCompanies: () => companiesMock(),
      company: (...args: unknown[]) => companyMock(...args),
      store: (...args: unknown[]) => storeMock(...args),
      updateStore: (...args: unknown[]) => updateStoreMock(...args),
      updateStoreStatus: (...args: unknown[]) => updateStatusMock(...args),
    },
  };
});

const COMPANY_ID = '11111111-1111-4111-8111-111111111111';
const STORE_ID = '22222222-2222-4222-8222-222222222222';
const PERMISSIONS = [
  'company.view',
  'license.view',
  'store.view',
  'store.create',
  'store.update',
  'store.deactivate',
];

function companyView(overrides: Partial<CompanyView> = {}): CompanyView {
  return {
    id: COMPANY_ID,
    name: 'شرکت آزمون',
    code: 'TEST-1',
    status: 'active',
    currency: 'IRR',
    role: 'manager',
    permissions: PERMISSIONS,
    subscription: {
      state: 'active',
      validUntil: null,
      graceEndsAt: null,
      writeAllowed: true,
      gracePeriodDays: 7,
    },
    storeUsage: { active: 1, limit: 3 },
    ...overrides,
  };
}

function storeView(overrides: Partial<StoreView> = {}): StoreView {
  return {
    id: STORE_ID,
    name: 'فروشگاه مرکزی',
    contactName: 'رضا محمدی',
    contactMobile: '+989121234567',
    address: 'تهران، خیابان نمونه',
    note: 'تحویل صبح‌ها',
    status: 'active',
    createdByUserId: null,
    updatedByUserId: null,
    createdAt: '2026-10-01T08:00:00.000Z',
    updatedAt: '2026-10-02T09:30:00.000Z',
    ...overrides,
  };
}

function renderDetail(company: CompanyView = companyView()) {
  companyMock.mockResolvedValue(company);
  localStorage.setItem('bz.activeCompanyId', COMPANY_ID);
  return render(
    <MemoryRouter initialEntries={[`/stores/${STORE_ID}`]}>
      <SessionProvider>
        <Routes>
          <Route path="/stores/:storeId" element={<StoreDetailPage />} />
        </Routes>
      </SessionProvider>
    </MemoryRouter>,
  );
}

describe('Store detail page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    meMock.mockResolvedValue({
      id: 'user-1',
      mobile: '+989120000001',
      fullName: 'مدیر آزمون',
      status: 'active',
    });
    companiesMock.mockResolvedValue([
      {
        id: COMPANY_ID,
        name: 'شرکت آزمون',
        code: 'TEST-1',
        status: 'active',
        currency: 'IRR',
        role: 'manager',
        membershipId: 'membership-1',
        permissions: PERMISSIONS,
      },
    ]);
    companyMock.mockResolvedValue(companyView());
    storeMock.mockResolvedValue(storeView());
  });

  it('renders store details and a permitted edit form', async () => {
    renderDetail();

    expect(await screen.findByRole('heading', { name: 'فروشگاه مرکزی' })).toBeInTheDocument();
    expect(screen.getByText('رضا محمدی')).toBeInTheDocument();
    expect(screen.getByText('+989121234567')).toBeInTheDocument();
    expect(screen.getAllByText('تهران، خیابان نمونه').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('نام فروشگاه *')).toHaveValue('فروشگاه مرکزی');
    expect(screen.getByRole('button', { name: 'غیرفعال کردن' })).toBeEnabled();
  });

  it('saves edits and reports success', async () => {
    updateStoreMock.mockResolvedValue(storeView({ name: 'فروشگاه نوسازی‌شده' }));
    renderDetail();

    const nameInput = await screen.findByLabelText('نام فروشگاه *');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'فروشگاه نوسازی‌شده');
    await userEvent.click(screen.getByRole('button', { name: 'ذخیره تغییرات' }));

    await waitFor(() => expect(updateStoreMock).toHaveBeenCalledTimes(1));
    expect(updateStoreMock).toHaveBeenCalledWith(
      COMPANY_ID,
      STORE_ID,
      expect.objectContaining({ name: 'فروشگاه نوسازی‌شده' }),
    );
    expect(await screen.findByText('تغییرات فروشگاه ذخیره شد.')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'فروشگاه نوسازی‌شده' }),
    ).toBeInTheDocument();
  });

  it('disables edits and status changes in read-only mode', async () => {
    renderDetail(
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

    expect(await screen.findByText('شرکت در حالت فقط‌خواندنی است')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'غیرفعال کردن' })).toBeDisabled();
    expect(screen.getByLabelText('نام فروشگاه *')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'ذخیره تغییرات' })).toBeDisabled();
  });

  it('hides write controls for roles without store permissions', async () => {
    const salesCompany = companyView({ permissions: ['store.view'], role: 'sales_representative' });
    companiesMock.mockResolvedValue([
      {
        id: COMPANY_ID,
        name: 'شرکت آزمون',
        code: 'TEST-1',
        status: 'active',
        currency: 'IRR',
        role: 'sales_representative',
        membershipId: 'membership-1',
        permissions: ['store.view'],
      },
    ]);
    renderDetail(salesCompany);

    expect(await screen.findByRole('heading', { name: 'فروشگاه مرکزی' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'غیرفعال کردن' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ذخیره تغییرات' })).not.toBeInTheDocument();
    expect(screen.getByText('ویرایش فروشگاه برای نقش شما مجاز نیست.')).toBeInTheDocument();
  });

  it('shows a safe not-found state for a foreign or missing store id', async () => {
    storeMock.mockRejectedValue(
      new ApiError({
        status: 404,
        code: 'RESOURCE_NOT_FOUND',
        message: 'مورد درخواستی در محدوده دسترسی شما یافت نشد.',
      }),
    );
    renderDetail();

    expect(await screen.findByText('فروشگاه یافت نشد')).toBeInTheDocument();
    expect(
      screen.getByText('این فروشگاه در محدوده شرکت فعال شما وجود ندارد یا حذف شده است.'),
    ).toBeInTheDocument();
  });
});
