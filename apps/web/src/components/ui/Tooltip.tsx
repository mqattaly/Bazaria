import { cloneElement, useId, type ReactElement } from 'react';

interface DescribedElementProps {
  'aria-describedby'?: string;
  title?: string;
}

interface TooltipProps {
  label: string;
  children: ReactElement<DescribedElementProps>;
}

export function Tooltip({ label, children }: TooltipProps) {
  const tooltipId = useId();
  const describedBy = [children.props['aria-describedby'], tooltipId].filter(Boolean).join(' ');
  const trigger = cloneElement(children, {
    'aria-describedby': describedBy,
    title: undefined,
  });

  return (
    <span className="group/tooltip relative inline-flex">
      {trigger}
      <span
        className="pointer-events-none invisible absolute start-1/2 top-full z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-inverse px-2.5 py-1.5 text-xs text-inverse-foreground opacity-0 shadow-popover transition-opacity group-hover/tooltip:visible group-hover/tooltip:opacity-100 group-focus-within/tooltip:visible group-focus-within/tooltip:opacity-100 motion-reduce:transition-none"
        id={tooltipId}
        role="tooltip"
      >
        {label}
      </span>
    </span>
  );
}
