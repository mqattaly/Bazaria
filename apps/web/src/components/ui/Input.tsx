import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { Icon, type IconName } from '../icons/Icon';
import { cn } from '../../lib/cn';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  hint?: string;
  error?: string;
  startIcon?: IconName;
  endAdornment?: ReactNode;
  wrapperClassName?: string;
}

const inputStyles =
  'min-h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-sm text-foreground placeholder:text-muted/70 ' +
  'outline-none transition-[border-color,box-shadow] ' +
  'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted';

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, startIcon, endAdornment, wrapperClassName, className, id, 'aria-describedby': ariaDescribedBy, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [ariaDescribedBy, hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('grid gap-1.5', wrapperClassName)}>
      <label className="text-sm font-medium text-foreground" htmlFor={inputId}>
        {label}
      </label>
      <div className="relative flex items-center">
        {startIcon ? <Icon className="pointer-events-none absolute start-3.5 text-muted" name={startIcon} size={18} /> : null}
        <input
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={cn(
            inputStyles,
            Boolean(startIcon) && 'ps-10',
            Boolean(endAdornment) && 'pe-10',
            error
              ? 'border-danger focus-visible:border-danger focus-visible:ring-2 focus-visible:ring-danger/20'
              : 'focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20',
            className,
          )}
          id={inputId}
          ref={ref}
          {...props}
        />
        {endAdornment ? <span className="absolute end-3.5 inline-flex items-center text-muted">{endAdornment}</span> : null}
      </div>
      {hint ? <p className="text-xs leading-5 text-muted" id={hintId}>{hint}</p> : null}
      {error ? <p className="text-xs leading-5 text-danger" id={errorId} role="alert">{error}</p> : null}
    </div>
  );
});
