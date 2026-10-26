import { Link } from 'react-router-dom';

export function NotFoundPage(): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md text-center">
        <p className="text-5xl font-bold text-brand-700">۴۰۴</p>
        <h1 className="mt-4 text-lg font-semibold text-slate-900">صفحه پیدا نشد</h1>
        <p className="mt-2 text-sm text-slate-500">
          نشانی واردشده وجود ندارد یا دسترسی به آن ممکن نیست.
        </p>
        <Link
          to="/companies"
          className="mt-6 inline-flex rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          بازگشت به انتخاب شرکت
        </Link>
      </div>
    </div>
  );
}
