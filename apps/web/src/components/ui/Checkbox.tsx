import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  description?: string;
  error?: string;
  wrapperClassName?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, error, wrapperClassName, id, ...props },
  ref,
) {
  const generatedId = useId();
  const checkboxId = id ?? generatedId;
  const descriptionId = description ? `${checkboxId}-description` : undefined;
  const errorId = error ? `${checkboxId}-error` : undefined;

  return (
    <div className={cn('grid gap-1.5', wrapperClassName)}>
      <label className="inline-flex min-h-11 cursor-pointer items-center gap-3 text-sm text-foreground" htmlFor={checkboxId}>
        <input
          aria-describedby={[descriptionId, errorId].filter(Boolean).join(' ') || undefined}
          aria-invalid={error ? true : undefined}
          className="size-4 rounded border-border accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed"
          id={checkboxId}
          ref={ref}
          type="checkbox"
          {...props}
        />
        <span>{label}</span>
      </label>
      {description ? <p className="ps-7 text-xs leading-5 text-muted" id={descriptionId}>{description}</p> : null}
      {error ? <p className="ps-7 text-xs leading-5 text-danger" id={errorId} role="alert">{error}</p> : null}
    </div>
  );
});
