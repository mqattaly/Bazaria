import type { IconName } from '../../components/icons/Icon';

export interface DashboardKpi {
  id: string;
  label: string;
  value: number;
  unit: 'تومان' | 'سفارش' | 'قلم' | 'مورد';
  icon: IconName;
  changePercent: number;
  changeDirection: 'up' | 'down';
  changeTone: 'positive' | 'neutral' | 'negative';
  comparison: string;
}

export interface DashboardQuickAction {
  id: string;
  label: string;
  description: string;
  icon: IconName;
}

export interface DashboardActivity {
  id: string;
  title: string;
  detail: string;
  time: string;
}

// Phase 1 design preview only — replace with API data in a later phase.
export const dashboardKpis: readonly DashboardKpi[] = [
  {
    id: 'sales-today',
    label: 'فروش امروز',
    value: 12_850_000,
    unit: 'تومان',
    icon: 'wallet',
    changePercent: 12,
    changeDirection: 'up',
    changeTone: 'positive',
    comparison: 'نسبت به دیروز',
  },
  {
    id: 'orders-today',
    label: 'تعداد سفارش‌ها',
    value: 12,
    unit: 'سفارش',
    icon: 'receipt',
    changePercent: 8,
    changeDirection: 'up',
    changeTone: 'positive',
    comparison: 'نسبت به دیروز',
  },
  {
    id: 'inventory-items',
    label: 'موجودی کالا',
    value: 348,
    unit: 'قلم',
    icon: 'box',
    changePercent: 4,
    changeDirection: 'up',
    changeTone: 'neutral',
    comparison: 'نسبت به هفتهٔ قبل',
  },
  {
    id: 'receivables',
    label: 'مطالبات',
    value: 4_820_000,
    unit: 'تومان',
    icon: 'chart',
    changePercent: 6,
    changeDirection: 'down',
    changeTone: 'positive',
    comparison: 'نسبت به دیروز',
  },
];

export const dashboardQuickActions: readonly DashboardQuickAction[] = [
  { id: 'new-order', label: 'ثبت سفارش', description: 'ثبت یک سفارش جدید', icon: 'sales' },
  { id: 'new-product', label: 'افزودن محصول', description: 'افزودن محصول به فهرست', icon: 'box' },
  { id: 'new-customer', label: 'افزودن مشتری', description: 'ثبت اطلاعات مشتری', icon: 'users' },
];

export const dashboardRecentActivities: readonly DashboardActivity[] = [];
