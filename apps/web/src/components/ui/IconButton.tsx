import type { ButtonHTMLAttributes } from 'react';
import { Icon, type IconName } from '../icons/Icon';
import { cn } from '../../lib/cn';
import type { ButtonVariant } from './Button';

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: IconName;
  label: string;
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
}

const sizes = {
  sm: 'size-9',
  md: 'size-11',
} satisfies Record<NonNullable<IconButtonProps['size']>, string>;

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary-hover',
  secondary: 'bg-surface-muted text-foreground hover:bg-surface-muted-hover',
  outline: 'border border-border bg-surface text-foreground hover:bg-surface-muted',
  ghost: 'bg-transparent text-muted hover:bg-surface-muted hover:text-foreground',
  danger: 'bg-danger-soft text-danger hover:bg-danger-soft',
};

export function IconButton({ icon, label, variant = 'ghost', size = 'md', className, type = 'button', ...props }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-xl transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none',
        sizes[size],
        variants[variant],
        className,
      )}
      title={label}
      type={type}
      {...props}
    >
      <Icon name={icon} size={size === 'sm' ? 18 : 20} />
    </button>
  );
}
