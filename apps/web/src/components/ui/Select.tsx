import { forwardRef, useId, type SelectHTMLAttributes } from 'react';
import { Icon } from '../icons/Icon';
import { cn } from '../../lib/cn';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: readonly SelectOption[];
  placeholder?: string;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, options, placeholder, hint, error, wrapperClassName, className, id, 'aria-describedby': ariaDescribedBy, ...props },
  ref,
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const hintId = hint ? `${selectId}-hint` : undefined;
  const errorId = error ? `${selectId}-error` : undefined;
  const describedBy = [ariaDescribedBy, hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('grid gap-1.5', wrapperClassName)}>
      <label className="text-sm font-medium text-foreground" htmlFor={selectId}>{label}</label>
      <div className="relative">
        <select
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={cn(
            'min-h-11 w-full appearance-none rounded-xl border border-border bg-surface ps-3.5 pe-10 text-sm text-foreground',
            'outline-none transition-[border-color,box-shadow]',
            'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted',
            error
              ? 'border-danger focus-visible:border-danger focus-visible:ring-2 focus-visible:ring-danger/20'
              : 'focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20',
            className,
          )}
          id={selectId}
          ref={ref}
          {...props}
        >
          {placeholder ? <option value="">{placeholder}</option> : null}
          {options.map((option) => (
            <option disabled={option.disabled} key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <Icon className="pointer-events-none absolute end-3.5 top-1/2 -translate-y-1/2 text-muted" name="chevron-down" size={18} />
      </div>
      {hint ? <p className="text-xs leading-5 text-muted" id={hintId}>{hint}</p> : null}
      {error ? <p className="text-xs leading-5 text-danger" id={errorId} role="alert">{error}</p> : null}
    </div>
  );
});
