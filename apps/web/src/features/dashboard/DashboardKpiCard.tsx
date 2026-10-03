import { Card } from '../../components/ui';
import { Icon } from '../../components/icons/Icon';
import type { DashboardKpi } from './dashboard.mock';

const persianNumber = new Intl.NumberFormat('fa-IR');
const amountNumber = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 });

const trendClasses = {
  positive: 'bg-success-soft text-success',
  neutral: 'bg-info-soft text-info',
  negative: 'bg-danger-soft text-danger',
} satisfies Record<DashboardKpi['changeTone'], string>;

export function DashboardKpiCard({ item }: { item: DashboardKpi }) {
  const formattedValue = item.unit === 'تومان' ? amountNumber.format(item.value) : persianNumber.format(item.value);

  return (
    <Card as="article" className="relative overflow-hidden transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-primary/25 motion-reduce:transition-none">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted sm:text-sm">{item.label}</p>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="text-2xl font-bold tracking-tight text-foreground sm:text-[1.7rem]" dir="auto">
              <bdi>{formattedValue}</bdi>
            </p>
            <span className="text-xs font-medium text-muted">{item.unit}</span>
          </div>
        </div>
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-strong">
          <Icon name={item.icon} size={19} />
        </span>
      </div>
      <div className="mt-4 flex items-center gap-1.5 text-xs">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[0.7rem] font-semibold ${trendClasses[item.changeTone]}`}>
          <Icon name={item.changeDirection === 'up' ? 'trend-up' : 'trend-down'} size={15} />
          <bdi>{persianNumber.format(item.changePercent)}٪</bdi>
        </span>
        <span className="text-muted">{item.comparison}</span>
      </div>
    </Card>
  );
}
