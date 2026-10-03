import { forwardRef, useId, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, wrapperClassName, className, id, 'aria-describedby': ariaDescribedBy, ...props },
  ref,
) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const hintId = hint ? `${textareaId}-hint` : undefined;
  const errorId = error ? `${textareaId}-error` : undefined;
  const describedBy = [ariaDescribedBy, hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('grid gap-1.5', wrapperClassName)}>
      <label className="text-sm font-medium text-foreground" htmlFor={textareaId}>{label}</label>
      <textarea
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className={cn(
          'min-h-28 w-full resize-y rounded-xl border border-border bg-surface px-3.5 py-3 text-sm text-foreground placeholder:text-muted/70',
          'outline-none transition-[border-color,box-shadow]',
          'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted',
          error
            ? 'border-danger focus-visible:border-danger focus-visible:ring-2 focus-visible:ring-danger/20'
            : 'focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20',
          className,
        )}
        id={textareaId}
        ref={ref}
        {...props}
      />
      {hint ? <p className="text-xs leading-5 text-muted" id={hintId}>{hint}</p> : null}
      {error ? <p className="text-xs leading-5 text-danger" id={errorId} role="alert">{error}</p> : null}
    </div>
  );
});
