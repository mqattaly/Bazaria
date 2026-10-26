import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreForm } from './StoreForm';
import { ApiError } from '../lib/api';

describe('Store form', () => {
  it('renders Persian labels and keeps optional fields empty', () => {
    render(<StoreForm submitLabel="ثبت فروشگاه" onSubmit={vi.fn()} />);

    expect(screen.getByLabelText('نام فروشگاه *')).toBeInTheDocument();
    expect(screen.getByLabelText('نام مسئول')).toHaveValue('');
    expect(screen.getByLabelText('موبایل تماس')).toHaveValue('');
    expect(screen.getByLabelText('نشانی')).toHaveValue('');
    expect(screen.getByLabelText('یادداشت')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'ثبت فروشگاه' })).toBeEnabled();
  });

  it('validates fields on the client and never calls the server with bad input', async () => {
    const onSubmit = vi.fn();
    render(<StoreForm submitLabel="ثبت فروشگاه" onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('نام فروشگاه *'), 'ا');
    await userEvent.type(screen.getByLabelText('موبایل تماس'), '12345');
    await userEvent.click(screen.getByRole('button', { name: 'ثبت فروشگاه' }));

    expect(
      screen.getByText('نام فروشگاه باید بین ۲ تا ۱۶۰ نویسه باشد.'),
    ).toBeInTheDocument();
    expect(screen.getByText('شماره موبایل تماس معتبر نیست. نمونه: ۰۹۱۲۱۲۳۴۵۶۷')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits trimmed values and converts blank optional fields to null', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<StoreForm submitLabel="ثبت فروشگاه" onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('نام فروشگاه *'), '  فروشگاه مرکزی  ');
    await userEvent.type(screen.getByLabelText('نام مسئول'), 'رضا محمدی');
    await userEvent.type(screen.getByLabelText('موبایل تماس'), '09121234567');
    await userEvent.type(screen.getByLabelText('نشانی'), 'تهران');
    await userEvent.click(screen.getByRole('button', { name: 'ثبت فروشگاه' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'فروشگاه مرکزی',
      contactName: 'رضا محمدی',
      contactMobile: '09121234567',
      address: 'تهران',
      note: null,
    });
  });

  it('prevents double submission while the request is in flight', async () => {
    let resolveSubmit: () => void = () => undefined;
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    render(<StoreForm submitLabel="ثبت فروشگاه" onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('نام فروشگاه *'), 'فروشگاه مرکزی');
    await userEvent.click(screen.getByRole('button', { name: 'ثبت فروشگاه' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'ثبت فروشگاه' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);

    resolveSubmit();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'ثبت فروشگاه' })).toBeEnabled(),
    );
  });

  it('keeps typed values when the network fails and shows a Persian error', async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValue(
        new ApiError({
          status: 0,
          code: 'NETWORK_ERROR',
          message: 'ارتباط با سرور برقرار نشد. اتصال شبکه را بررسی کنید.',
          retryable: true,
        }),
      );
    render(<StoreForm submitLabel="ثبت فروشگاه" onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('نام فروشگاه *'), 'فروشگاه مرکزی');
    await userEvent.type(screen.getByLabelText('نشانی'), 'تهران');
    await userEvent.click(screen.getByRole('button', { name: 'ثبت فروشگاه' }));

    expect(
      await screen.findByText('ارتباط با سرور برقرار نشد. اتصال شبکه را بررسی کنید.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('نام فروشگاه *')).toHaveValue('فروشگاه مرکزی');
    expect(screen.getByLabelText('نشانی')).toHaveValue('تهران');
  });

  it('maps server field errors back to the matching input', async () => {
    const onSubmit = vi.fn().mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'اطلاعات ورودی معتبر نیست.',
        details: [{ field: 'name', code: 'INVALID_NAME', message: 'این نام تکراری است.' }],
      }),
    );
    render(<StoreForm submitLabel="ثبت فروشگاه" onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('نام فروشگاه *'), 'فروشگاه مرکزی');
    await userEvent.click(screen.getByRole('button', { name: 'ثبت فروشگاه' }));

    expect(await screen.findByText('این نام تکراری است.')).toBeInTheDocument();
    expect(screen.getByLabelText('نام فروشگاه *')).toHaveAttribute('aria-invalid', 'true');
  });

  it('disables all inputs when the subscription is read-only', () => {
    render(
      <StoreForm
        submitLabel="ذخیره تغییرات"
        onSubmit={vi.fn()}
        disabled
        disabledReason="پس از پایان مهلت ارفاقی، ثبت تغییرات تا تمدید اشتراک ممکن نیست."
      />,
    );

    expect(screen.getByLabelText('نام فروشگاه *')).toBeDisabled();
    expect(screen.getByLabelText('یادداشت')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'ذخیره تغییرات' })).toBeDisabled();
    expect(
      screen.getByText('پس از پایان مهلت ارفاقی، ثبت تغییرات تا تمدید اشتراک ممکن نیست.'),
    ).toBeInTheDocument();
  });
});
