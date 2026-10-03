import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  shape?: 'line' | 'circle' | 'block';
}

export function Skeleton({ shape = 'line', className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse bg-surface-muted',
        shape === 'line' && 'h-4 rounded-md',
        shape === 'circle' && 'size-10 rounded-full',
        shape === 'block' && 'min-h-24 rounded-xl',
        className,
      )}
      {...props}
    />
  );
}
