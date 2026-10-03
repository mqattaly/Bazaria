import { NavLink } from 'react-router-dom';
import { Icon, type IconName } from '../icons/Icon';
import { cn } from '../../lib/cn';

interface NavigationItem {
  label: string;
  icon: IconName;
  to?: string;
}

const navigationItems: readonly NavigationItem[] = [
  { label: 'داشبورد', icon: 'dashboard', to: '/dashboard' },
  { label: 'فروش', icon: 'sales' },
  { label: 'محصولات', icon: 'box' },
  { label: 'مشتریان', icon: 'users' },
  { label: 'انبار', icon: 'warehouse' },
  { label: 'گزارش‌ها', icon: 'chart' },
  { label: 'تنظیمات', icon: 'settings' },
];

interface SidebarMenuProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function SidebarMenu({ collapsed = false, onNavigate }: SidebarMenuProps) {
  return (
    <nav aria-label="منوی اصلی" className="flex-1 px-3 py-5">
      {!collapsed ? <p className="mb-2 px-3 text-[0.68rem] font-semibold tracking-wide text-sidebar-muted">بخش‌های برنامه</p> : null}
      <ul className="grid gap-1">
        {navigationItems.map((item) => (
          <li key={item.label}>
            {item.to ? (
              <NavLink
                aria-label={collapsed ? item.label : undefined}
                className={({ isActive }) => cn(
                  'group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
                  collapsed && 'justify-center px-0',
                  isActive
                    ? 'bg-sidebar-active text-sidebar-active-foreground shadow-sm'
                    : 'text-sidebar-foreground/75 hover:bg-sidebar-hover hover:text-sidebar-foreground',
                )}
                onClick={onNavigate}
                title={collapsed ? item.label : undefined}
                to={item.to}
              >
                {({ isActive }) => (
                  <>
                    <Icon className={cn('shrink-0', isActive ? 'text-sidebar-active-icon' : 'text-sidebar-muted group-hover:text-sidebar-foreground')} name={item.icon} />
                    <span className={cn('min-w-0 flex-1 truncate', collapsed && 'sr-only')}>{item.label}</span>
                  </>
                )}
              </NavLink>
            ) : (
              <button
                aria-label={collapsed ? `${item.label}، به‌زودی` : undefined}
                className={cn(
                  'flex min-h-11 w-full cursor-not-allowed items-center gap-3 rounded-xl px-3 text-start text-sm font-medium text-sidebar-muted/80 opacity-80',
                  collapsed && 'justify-center px-0',
                )}
                disabled
                title={`${item.label} — به‌زودی`}
                type="button"
              >
                <Icon className="shrink-0" name={item.icon} />
                <span className={cn('min-w-0 flex-1 truncate', collapsed && 'sr-only')}>{item.label}</span>
                {!collapsed ? <span className="rounded-full bg-sidebar-hover px-2 py-1 text-[0.68rem] font-semibold text-sidebar-muted">به‌زودی</span> : null}
              </button>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

interface SidebarProps extends SidebarMenuProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function Sidebar({ collapsed, onToggleCollapsed }: SidebarProps) {
  return (
    <aside
      aria-label="ناوبری اصلی"
      className={cn(
        'sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden border-e border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 lg:flex motion-reduce:transition-none',
        collapsed ? 'w-20' : 'w-64',
      )}
    >
      <div className={cn('flex h-20 shrink-0 items-center border-b border-sidebar-border', collapsed ? 'justify-center gap-1 px-1' : 'justify-between px-4')}>
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className={cn('grid shrink-0 place-items-center rounded-xl bg-primary font-extrabold text-primary-foreground', collapsed ? 'size-8 text-base' : 'size-10 text-lg')}>ب</span>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate text-base font-bold">بازاریا</p>
              <p className="mt-0.5 truncate text-[0.68rem] text-sidebar-muted">مدیریت فروشگاه</p>
            </div>
          ) : null}
        </div>
        <button
          aria-label={collapsed ? 'باز کردن نوار کناری' : 'جمع کردن نوار کناری'}
          className={cn(
            'grid shrink-0 place-items-center rounded-lg text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            collapsed ? 'size-8' : 'size-9',
          )}
          onClick={onToggleCollapsed}
          title={collapsed ? 'باز کردن نوار کناری' : 'جمع کردن نوار کناری'}
          type="button"
        >
          <Icon name={collapsed ? 'chevron-left' : 'chevron-right'} size={18} />
        </button>
      </div>
      <SidebarMenu collapsed={collapsed} />
      <div className={cn('border-t border-sidebar-border px-4 py-4 text-xs text-sidebar-muted', collapsed && 'px-2 text-center')}>
        {collapsed ? '۱٫۰' : 'بازاریا · نسخهٔ پایه'}
      </div>
    </aside>
  );
}
