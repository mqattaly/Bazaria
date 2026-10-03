import { Icon } from '../../components/icons/Icon';
import { Badge, Breadcrumb, Button, Card, EmptyState, PageHeader, Table, type TableColumn } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { DashboardKpiCard } from './DashboardKpiCard';
import { dashboardKpis, dashboardQuickActions, dashboardRecentActivities, type DashboardActivity } from './dashboard.mock';

const activityColumns: readonly TableColumn<DashboardActivity>[] = [
  { id: 'title', header: 'فعالیت', cell: (activity) => activity.title },
  { id: 'detail', header: 'جزئیات', cell: (activity) => activity.detail },
  { id: 'time', header: 'زمان', cell: (activity) => activity.time, align: 'end' },
];

export function DashboardPage() {
  const toast = useToast();

  return (
    <div className="grid gap-7 sm:gap-8">
      <Breadcrumb items={[{ label: 'خانه', to: '/dashboard' }, { label: 'داشبورد' }]} />

      <PageHeader
        actions={<Badge size="md" variant="info"><Icon name="info" size={14} /> اطلاعات نمایشی</Badge>}
        description="نمای کلی وضعیت فروشگاه؛ این اعداد نمونه هستند و از اطلاعات واقعی دریافت نشده‌اند."
        eyebrow={<span className="text-xs font-semibold text-primary">خلاصهٔ امروز</span>}
        title="داشبورد"
      />

      <section aria-label="شاخص‌های نمونه" className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {dashboardKpis.map((item) => <DashboardKpiCard item={item} key={item.id} />)}
      </section>

      <section aria-labelledby="quick-actions-title">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-foreground" id="quick-actions-title">دسترسی سریع</h2>
            <p className="mt-1 text-xs text-muted">میانبرها برای دسترسی آسان‌تر آماده شده‌اند.</p>
          </div>
          <span className="text-[0.68rem] text-muted">عملیات در فازهای بعدی فعال می‌شوند</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {dashboardQuickActions.map((action) => (
            <Card className="p-1.5" key={action.id} padded={false}>
              <Button
                className="min-h-[4.5rem] w-full justify-start gap-3 rounded-xl px-3 text-start"
                onClick={() => toast.info('این میانبر هنوز فعال نیست', 'قابلیت‌های عملیاتی در فازهای بعدی اضافه می‌شوند.')}
                variant="ghost"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-strong">
                  <Icon name={action.icon} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">{action.label}</span>
                  <span className="mt-0.5 block text-xs font-normal text-muted">{action.description}</span>
                </span>
                <Icon className="text-muted" name="arrow-up-right" size={17} />
              </Button>
            </Card>
          ))}
        </div>
      </section>

      <Card as="section" aria-labelledby="activity-title" padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
          <div>
            <h2 className="text-base font-bold text-foreground" id="activity-title">فعالیت‌های اخیر</h2>
            <p className="mt-1 text-xs text-muted">پس از اتصال اطلاعات واقعی، رویدادها اینجا نمایش داده می‌شوند.</p>
          </div>
          <Badge variant="neutral">در انتظار اطلاعات</Badge>
        </div>
        <div className="border-t border-border px-3 py-2 sm:px-4">
          <Table
            ariaLabel="فعالیت‌های اخیر نمونه"
            caption="جدول فعالیت‌های اخیر"
            columns={activityColumns}
            emptyState={
              <EmptyState
                compact
                description="هنوز اطلاعاتی برای نمایش وجود ندارد. فعالیت‌های ثبت‌شده در این بخش دیده می‌شوند."
                icon="receipt"
                title="هنوز فعالیتی ثبت نشده است"
              />
            }
            getRowId={(activity) => activity.id}
            rows={dashboardRecentActivities}
          />
        </div>
      </Card>
    </div>
  );
}
