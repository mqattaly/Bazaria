import { useQuery } from '@tanstack/react-query';
import { Icon, type IconName } from '../icons/Icon';
import { useTheme } from '../providers/ThemeProvider';
import { Badge } from '../ui/Badge';
import { Dropdown, DropdownItem } from '../ui/Dropdown';
import { IconButton } from '../ui/IconButton';
import { Tooltip } from '../ui/Tooltip';
import { useToast } from '../ui/Toast';
import { fetchHealth } from '../../services/health';
import { cn } from '../../lib/cn';

interface HeaderProps {
  onOpenNavigation: () => void;
}

export function Header({ onOpenNavigation }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();
  const health = useQuery({ queryKey: ['api-health'], queryFn: fetchHealth });
  const themeIcon: IconName = theme === 'light' ? 'moon' : 'sun';
  const themeLabel = theme === 'light' ? 'فعال کردن پوستهٔ تیره' : 'فعال کردن پوستهٔ روشن';

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur-sm">
      <div className="flex min-h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:min-h-[4.5rem] lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <IconButton className="lg:hidden" icon="menu" label="باز کردن منوی اصلی" onClick={onOpenNavigation} />
          <div className="min-w-0">
            <p className="text-[0.68rem] text-muted">فضای کاری</p>
            <p className="truncate text-sm font-semibold text-foreground sm:text-base">پنل بازاریا</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <div className="hidden sm:block">
            <Badge className="gap-1.5" variant={health.isSuccess ? 'success' : health.isPending ? 'warning' : 'neutral'}>
              <span className={cn('size-1.5 rounded-full', health.isSuccess ? 'bg-success' : health.isPending ? 'bg-warning' : 'bg-muted')} aria-hidden="true" />
              {health.isPending ? 'در حال بررسی' : health.isSuccess ? 'متصل' : 'آفلاین'}
            </Badge>
          </div>

          <Tooltip label={themeLabel}>
            <IconButton icon={themeIcon} label={themeLabel} onClick={toggleTheme} />
          </Tooltip>
          <Tooltip label="نمایش اعلان‌ها">
            <IconButton
              icon="bell"
              label="نمایش اعلان‌ها"
              onClick={() => toast.info('اعلان تازه‌ای ندارید', 'اعلان‌های مهم در این بخش نمایش داده می‌شوند.')}
            />
          </Tooltip>

          <Dropdown
            label="باز کردن منوی کاربر"
            triggerContent={
              <span className="flex min-h-11 items-center gap-2 rounded-xl px-1.5 text-start hover:bg-surface-muted sm:px-2">
                <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary-strong">م</span>
                <span className="hidden text-xs font-semibold text-foreground sm:block">حساب نمایشی</span>
                <Icon className="text-muted" name="chevron-down" size={16} />
              </span>
            }
          >
            <div className="border-b border-border px-3 py-2.5">
              <p className="text-xs font-semibold text-foreground">محیط نمایشی</p>
              <p className="mt-0.5 text-[0.68rem] text-muted">حساب کاربری هنوز فعال نیست</p>
            </div>
            <DropdownItem onSelect={toggleTheme}>
              <Icon className="me-2" name={theme === 'light' ? 'moon' : 'sun'} size={17} />
              {theme === 'light' ? 'تغییر به پوستهٔ تیره' : 'تغییر به پوستهٔ روشن'}
            </DropdownItem>
          </Dropdown>
        </div>
      </div>
    </header>
  );
}
