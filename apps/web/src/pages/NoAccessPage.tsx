import { Link } from 'react-router-dom';
import { useSession } from '../session/SessionContext';
import { Layout } from '../components/Layout';
import { Button, Card } from '../components/ui';

export function NoAccessPage(): JSX.Element {
  const { companies, user, logout } = useSession();

  return (
    <Layout>
      <Card title="دسترسی به این بخش ممکن نیست">
        <p className="text-sm text-slate-600">
          {companies.length > 0
            ? 'برای مشاهده داده شرکت، ابتدا یکی از شرکت‌های خود را انتخاب کنید.'
            : 'حساب شما هنوز به هیچ شرکتی متصل نیست. اگر انتظار دارید دسترسی داشته باشید، با مدیر شرکت تماس بگیرید.'}
        </p>
        {user ? (
          <p className="mt-2 text-xs text-slate-500" dir="auto">
            حساب کاربری: {user.fullName} — {user.mobile}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          {companies.length > 0 ? (
            <Link
              to="/companies"
              className="inline-flex items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              انتخاب شرکت
            </Link>
          ) : null}
          <Button variant="secondary" onClick={() => void logout()}>
            خروج از حساب
          </Button>
        </div>
      </Card>
    </Layout>
  );
}
