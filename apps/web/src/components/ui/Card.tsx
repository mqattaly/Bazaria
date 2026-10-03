import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface CardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  as?: 'article' | 'section' | 'div';
  padded?: boolean;
}

export function Card({ children, as = 'section', padded = true, className, ...props }: CardProps) {
  const Component = as;
  return (
    <Component
      className={cn('rounded-2xl border border-border bg-surface shadow-card', padded && 'p-4 sm:p-5', className)}
      {...props}
    >
      {children}
    </Component>
  );
}
