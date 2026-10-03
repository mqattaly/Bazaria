import type { ReactNode } from 'react';
import { Icon, type IconName } from '../icons/Icon';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: IconName;
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({ title, description, icon = 'box', action, compact = false }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center text-center ${compact ? 'py-5' : 'py-9'}`}>
      <span className="grid size-11 place-items-center rounded-2xl bg-surface-muted text-muted">
        <Icon name={icon} />
      </span>
      <h3 className="mt-3 text-sm font-bold text-foreground">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-xs leading-6 text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
