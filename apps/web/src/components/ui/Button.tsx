import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
}

const variants: Record<ButtonVariant, string> = {
  primary: 'border border-primary bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover active:bg-primary-strong',
  secondary: 'border border-transparent bg-surface-muted text-foreground hover:bg-surface-muted-hover',
  outline: 'border border-border bg-surface text-foreground hover:bg-surface-muted',
  ghost: 'border border-transparent bg-transparent text-muted hover:bg-surface-muted hover:text-foreground',
  danger: 'border border-danger bg-danger text-danger-foreground hover:bg-danger-hover active:bg-danger-strong',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-9 gap-2 px-3 text-xs',
  md: 'min-h-11 gap-2 px-4 text-sm',
  lg: 'min-h-12 gap-2.5 px-5 text-sm',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-semibold transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none',
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      type={type}
      {...props}
    >
      {loading ? <Spinner size="sm" /> : null}
      {children}
    </button>
  );
}
