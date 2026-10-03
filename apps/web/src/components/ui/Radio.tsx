import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  description?: string;
  wrapperClassName?: string;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { label, description, wrapperClassName, id, ...props },
  ref,
) {
  const generatedId = useId();
  const radioId = id ?? generatedId;
  const descriptionId = description ? `${radioId}-description` : undefined;

  return (
    <div className={cn('grid gap-1', wrapperClassName)}>
      <label className="inline-flex min-h-11 cursor-pointer items-center gap-3 text-sm text-foreground" htmlFor={radioId}>
        <input
          aria-describedby={descriptionId}
          className="size-4 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed"
          id={radioId}
          ref={ref}
          type="radio"
          {...props}
        />
        <span>{label}</span>
      </label>
      {description ? <p className="ps-7 text-xs leading-5 text-muted" id={descriptionId}>{description}</p> : null}
    </div>
  );
});
