import { cn } from '../../lib/cn';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: 'size-4 border-2',
  md: 'size-5 border-2',
  lg: 'size-7 border-[3px]',
} satisfies Record<NonNullable<SpinnerProps['size']>, string>;

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block shrink-0 animate-spin rounded-full border-current border-e-transparent', sizes[size], className)}
    />
  );
}
