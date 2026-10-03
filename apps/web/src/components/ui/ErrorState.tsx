import type { ReactNode } from 'react';
import { Icon } from '../icons/Icon';
import { Button } from './Button';
import { Card } from './Card';

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  action?: ReactNode;
  compact?: boolean;
}

export function ErrorState({
  title = 'خطایی رخ داد',
  description = 'لطفاً دوباره تلاش کنید.',
  onRetry,
  retryLabel = 'تلاش دوباره',
  action,
  compact = false,
}: ErrorStateProps) {
  return (
    <Card as="div" className={`text-center ${compact ? 'py-6' : 'py-10'}`} role="alert">
      <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-danger-soft text-danger">
        <Icon name="alert" />
      </span>
      <h2 className="mt-4 text-base font-bold text-foreground">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted">{description}</p>
      {action ?? (onRetry ? (
        <Button className="mt-5" onClick={onRetry} variant="outline">
          <Icon name="refresh" size={17} />
          {retryLabel}
        </Button>
      ) : null)}
    </Card>
  );
}
