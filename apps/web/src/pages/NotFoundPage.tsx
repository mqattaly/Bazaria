import { Link } from 'react-router-dom';
import { Icon } from '../components/icons/Icon';
import { Card } from '../components/ui';

export function NotFoundPage() {
  return (
    <Card as="section" className="mx-auto max-w-xl py-10 text-center" role="status">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary-strong">
        <Icon name="search" size={21} />
      </span>
      <p className="mt-4 text-xs font-semibold text-primary">خطای ۴۰۴</p>
      <h1 className="mt-2 text-xl font-bold text-foreground">این صفحه پیدا نشد</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">
        نشانی واردشده معتبر نیست یا این بخش هنوز در بازاریا ساخته نشده است.
      </p>
      <Link className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background" to="/dashboard">
        <Icon name="chevron-right" size={16} />
        بازگشت به داشبورد
      </Link>
    </Card>
  );
}
