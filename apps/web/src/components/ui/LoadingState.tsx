import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
import { Spinner } from './Spinner';

interface LoadingStateProps extends HTMLAttributes<HTMLDivElement> {
  label?: string;
  compact?: boolean;
}

export function LoadingState({ label = 'در حال بارگذاری اطلاعات…', compact = false, className, ...props }: LoadingStateProps) {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className={cn('flex items-center justify-center gap-3 text-sm text-muted', compact ? 'min-h-20' : 'min-h-56', className)}
      role="status"
      {...props}
    >
      <Spinner size="md" />
      <span>{label}</span>
    </div>
  );
}
