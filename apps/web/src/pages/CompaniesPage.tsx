import { useNavigate } from 'react-router-dom';
import { useSession } from '../session/SessionContext';
import { Layout } from '../components/Layout';
import { Alert, Badge, Button, Card } from '../components/ui';
import { currencyLabel, roleLabel } from '../lib/text';

export function CompaniesPage(): JSX.Element {
  const { companies, selectCompany } = useSession();
  const navigate = useNavigate();

  function choose(companyId: string): void {
    selectCompany(companyId);
    navigate('/company');
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">انتخاب شرکت فعال</h1>
        <p className="mt-2 text-sm text-slate-500">
          شما ممکن است در چند شرکت عضو باشید. داده‌هایی که می‌بینید فقط به شرکت فعال
          مربوط می‌شوند و نقش شما در هر شرکت مستقل است.
        </p>
      </div>

      {companies.length === 0 ? (
        <Alert tone="info" title="هنوز به هیچ شرکتی متصل نیستید">
          برای دسترسی، از مدیر شرکت بخواهید عضویت شما را در شرکت ثبت کند. پس از آن
          می‌توانید شرکت فعال خود را انتخاب کنید.
        </Alert>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {companies.map((company) => {
            const suspended =
              company.status !== 'active';
            return (
              <Card key={company.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">{company.name}</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      کد شرکت: <span dir="ltr">{company.code}</span>
                    </p>
                  </div>
                  <Badge tone={suspended ? 'warning' : 'success'}>
                    {suspended ? 'غیرفعال' : 'فعال'}
                  </Badge>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-slate-500">نقش شما</dt>
                    <dd className="mt-1 font-medium text-slate-800">{roleLabel(company.role)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">واحد پول</dt>
                    <dd className="mt-1 text-slate-800">{currencyLabel(company.currency)}</dd>
                  </div>
                </dl>

                <div className="mt-5">
                  <Button
                    className="w-full"
                    onClick={() => choose(company.id)}
                    disabled={suspended}
                  >
                    {suspended ? 'شرکت غیرفعال است' : 'انتخاب این شرکت'}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-xs text-slate-400">
        تغییر شرکت فعال، زمینه همه درخواست‌های بعدی را تغییر می‌دهد و در سرور اعتبارسنجی می‌شود.
      </p>
    </Layout>
  );
}
