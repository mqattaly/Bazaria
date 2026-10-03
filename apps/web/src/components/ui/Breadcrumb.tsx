import { Link } from 'react-router-dom';
import { Icon } from '../icons/Icon';

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface BreadcrumbProps {
  items: readonly BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav aria-label="مسیر صفحه" className={className}>
      <ol className="flex min-h-8 flex-wrap items-center gap-1.5 text-xs text-muted">
        {items.map((item, index) => {
          const isCurrent = index === items.length - 1;
          return (
            <li className="inline-flex items-center gap-1.5" key={`${item.label}-${index}`}>
              {index > 0 ? <Icon aria-hidden="true" className="text-muted/70" name="chevron-left" size={15} /> : null}
              {item.to && !isCurrent ? (
                <Link className="rounded-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background" to={item.to}>{item.label}</Link>
              ) : (
                <span aria-current={isCurrent ? 'page' : undefined} className={isCurrent ? 'font-semibold text-foreground' : undefined}>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
