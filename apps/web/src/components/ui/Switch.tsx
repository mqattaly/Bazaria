import { useId } from 'react';
import { cn } from '../../lib/cn';

interface SwitchProps {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  description?: string;
  disabled?: boolean;
  className?: string;
}

export function Switch({ label, checked, onCheckedChange, description, disabled = false, className }: SwitchProps) {
  const id = useId();
  const descriptionId = description ? `${id}-description` : undefined;

  return (
    <div className={cn('flex min-h-12 items-center justify-between gap-4', className)}>
      <div className="grid gap-0.5">
        <span className="text-sm font-medium text-foreground" id={`${id}-label`}>{label}</span>
        {description ? <span className="text-xs leading-5 text-muted" id={descriptionId}>{description}</span> : null}
      </div>
      <button
        aria-checked={checked}
        aria-describedby={descriptionId}
        aria-labelledby={`${id}-label`}
        className={cn(
          'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          checked ? 'bg-primary' : 'bg-border',
          'disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none',
        )}
        disabled={disabled}
        id={id}
        onClick={() => onCheckedChange(!checked)}
        role="switch"
        type="button"
      >
        <span className={cn('absolute start-1 top-1 size-5 rounded-full bg-surface shadow-sm transition-transform motion-reduce:transition-none', checked && '-translate-x-5')} />
      </button>
    </div>
  );
}
