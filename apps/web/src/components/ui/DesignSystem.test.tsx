import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Icon } from '../icons/Icon';
import { Badge } from './Badge';
import { Button } from './Button';
import { Checkbox } from './Checkbox';
import { Dropdown, DropdownItem } from './Dropdown';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { Input } from './Input';
import { Modal } from './Modal';
import { Pagination } from './Pagination';
import { Radio } from './Radio';
import { Select } from './Select';
import { Skeleton } from './Skeleton';
import { Switch } from './Switch';
import { Table, type TableColumn } from './Table';
import { Tabs } from './Tabs';
import { Textarea } from './Textarea';
import { Tooltip } from './Tooltip';
import { ToastProvider, useToast } from './Toast';

afterEach(cleanup);

describe('Reusable design-system components', () => {
  it('provides button variants and an accessible loading/disabled state', () => {
    render(
      <>
        <Button variant="danger">حذف</Button>
        <Button loading>ذخیره</Button>
        <Button disabled variant="outline">غیرفعال</Button>
      </>,
    );

    expect(screen.getByRole('button', { name: 'حذف' })).toHaveClass('bg-danger');
    expect(screen.getByRole('button', { name: /ذخیره/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /ذخیره/ })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'غیرفعال' })).toBeDisabled();
  });

  it('connects form labels, helper text, and validation messages', () => {
    render(
      <>
        <Input error="نام را وارد کنید." hint="نام نمایشی" label="نام فروشگاه" />
        <Textarea label="نشانی" />
        <Select label="شهر" options={[{ value: 'tehran', label: 'تهران' }]} placeholder="انتخاب شهر" />
        <Checkbox label="فروشگاه فعال" />
        <Radio label="گزینهٔ پیش‌فرض" name="mode" value="default" />
      </>,
    );

    expect(screen.getByLabelText('نام فروشگاه')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('نام را وارد کنید.');
    expect(screen.getByLabelText('نشانی')).toBeInTheDocument();
    expect(screen.getByLabelText('شهر')).toBeInTheDocument();
    expect(screen.getByLabelText('فروشگاه فعال')).toBeInTheDocument();
    expect(screen.getByLabelText('گزینهٔ پیش‌فرض')).toBeInTheDocument();
  });

  it('keeps decorative skeletons out of the accessibility tree', () => {
    render(<Skeleton data-testid="loading-skeleton" shape="circle" />);

    expect(screen.getByTestId('loading-skeleton')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('loading-skeleton')).toHaveClass('rounded-full');
  });

  it('announces an empty table state and supports loading rows', () => {
    interface Row { id: string; label: string }
    const columns: readonly TableColumn<Row>[] = [{ id: 'label', header: 'نام', cell: (row) => row.label }];
    const { rerender } = render(
      <Table ariaLabel="فهرست نمونه" columns={columns} getRowId={(row) => row.id} rows={[]} />,
    );

    expect(screen.getByText('موردی برای نمایش نیست')).toBeInTheDocument();
    rerender(<Table ariaLabel="فهرست نمونه" columns={columns} getRowId={(row) => row.id} loading rows={[]} />);
    expect(screen.getByRole('status')).toHaveTextContent('در حال بارگذاری اطلاعات');
  });

  it('renders reusable empty and retryable error states', () => {
    const retry = vi.fn();
    render(
      <>
        <EmptyState description="برای شروع، اولین مورد را ثبت کنید." title="هنوز اطلاعاتی ثبت نشده است" />
        <ErrorState onRetry={retry} />
      </>,
    );

    expect(screen.getByText('هنوز اطلاعاتی ثبت نشده است')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /تلاش دوباره/ }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('toggles a switch and moves focus through an RTL dropdown menu', () => {
    const onCheckedChange = vi.fn();
    render(
      <>
        <Switch checked label="حالت تیره" onCheckedChange={onCheckedChange} />
        <Dropdown label="منوی آزمایشی" triggerContent={<span>باز کردن منو</span>}>
          <DropdownItem>گزینهٔ نخست</DropdownItem>
          <DropdownItem>گزینهٔ دوم</DropdownItem>
        </Dropdown>
      </>,
    );

    fireEvent.click(screen.getByRole('switch', { name: 'حالت تیره' }));
    expect(onCheckedChange).toHaveBeenCalledWith(false);
    fireEvent.click(screen.getByRole('button', { name: 'منوی آزمایشی' }));
    const firstItem = screen.getByRole('menuitem', { name: 'گزینهٔ نخست' });
    const secondItem = screen.getByRole('menuitem', { name: 'گزینهٔ دوم' });
    firstItem.focus();
    fireEvent.keyDown(firstItem, { key: 'ArrowDown' });
    expect(secondItem).toHaveFocus();
  });

  it('changes accessible tabs with the RTL arrow-key convention', () => {
    const onValueChange = vi.fn();
    render(
      <Tabs
        items={[
          { value: 'summary', label: 'نمای کلی', content: 'محتوای نمای کلی' },
          { value: 'details', label: 'جزئیات', content: 'محتوای جزئیات' },
        ]}
        label="تب‌های داشبورد"
        onValueChange={onValueChange}
        value="summary"
      />,
    );

    fireEvent.keyDown(screen.getByRole('tab', { name: 'نمای کلی' }), { key: 'ArrowLeft' });
    expect(onValueChange).toHaveBeenCalledWith('details');
  });

  it('controls a modal with a labelled native dialog', () => {
    const onOpenChange = vi.fn();
    render(
      <Modal onOpenChange={onOpenChange} open title="تأیید عملیات">
        <p>محتوای پنجره</p>
      </Modal>,
    );

    expect(screen.getByRole('dialog', { name: 'تأیید عملیات' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'بستن پنجره' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('announces, dismisses, and labels toast notifications', () => {
    function ToastTrigger() {
      const toast = useToast();
      return <Button onClick={() => toast.success('ذخیره شد', 'تغییرات ثبت شدند.')}>نمایش اعلان</Button>;
    }

    render(<ToastProvider><ToastTrigger /></ToastProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'نمایش اعلان' }));
    expect(screen.getByRole('status')).toHaveTextContent('ذخیره شد');
    fireEvent.click(screen.getByRole('button', { name: 'بستن اعلان' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('keeps pagination bounds and tooltips accessible', () => {
    const onPageChange = vi.fn();
    render(
      <>
        <Pagination onPageChange={onPageChange} page={1} totalPages={3} />
        <Tooltip label="راهنمای دکمه">
          <Button><Icon name="info" />راهنما</Button>
        </Tooltip>
        <Badge variant="warning">در انتظار</Badge>
      </>,
    );

    expect(screen.getByRole('button', { name: 'رفتن به صفحهٔ قبل' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'راهنما' })).toHaveAttribute('aria-describedby');
    expect(screen.getByRole('tooltip')).toHaveTextContent('راهنمای دکمه');
    expect(screen.getByText('در انتظار')).toHaveClass('bg-warning-soft');
  });
});
