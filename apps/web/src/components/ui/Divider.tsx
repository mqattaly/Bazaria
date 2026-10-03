import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

interface DividerProps extends HTMLAttributes<HTMLHRElement> {
  orientation?: 'horizontal' | 'vertical';
}

export function Divider({ orientation = 'horizontal', className, ...props }: DividerProps) {
  return (
    <hr
      aria-orientation={orientation}
      className={cn(
        'shrink-0 border-0 bg-border',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px self-stretch',
        className,
      )}
      role="separator"
      {...props}
    />
  );
}
