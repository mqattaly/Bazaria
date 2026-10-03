import { useId, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface TabItem {
  value: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
}

interface TabsProps {
  items: readonly TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  className?: string;
}

function toSafeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}

export function Tabs({ items, value, onValueChange, label, className }: TabsProps) {
  const id = useId();
  const activeTab = items.find((item) => item.value === value) ?? items[0];

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const enabledItems = items.filter((item) => !item.disabled);
    const index = enabledItems.findIndex((item) => item.value === value);
    let nextIndex = index;

    if (event.key === 'ArrowLeft') nextIndex = (index + 1) % enabledItems.length;
    else if (event.key === 'ArrowRight') nextIndex = (index - 1 + enabledItems.length) % enabledItems.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = enabledItems.length - 1;
    else return;

    event.preventDefault();
    const nextTab = enabledItems[nextIndex];
    if (nextTab) onValueChange(nextTab.value);
    requestAnimationFrame(() => {
      document.getElementById(`${id}-tab-${toSafeId(enabledItems[nextIndex]?.value ?? '')}`)?.focus();
    });
  }

  if (!activeTab) return null;

  return (
    <div className={className}>
      <div
        aria-label={label}
        className="flex gap-1 overflow-x-auto border-b border-border"
        onKeyDown={handleKeyDown}
        role="tablist"
      >
        {items.map((item) => {
          const selected = item.value === activeTab.value;
          const safeId = toSafeId(item.value);
          return (
            <button
              aria-controls={`${id}-panel-${safeId}`}
              aria-selected={selected}
              className={cn(
                'relative min-h-11 shrink-0 px-3 text-sm font-medium transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-transparent',
                selected ? 'text-primary after:bg-primary' : 'text-muted hover:text-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
              disabled={item.disabled}
              id={`${id}-tab-${safeId}`}
              key={item.value}
              onClick={() => onValueChange(item.value)}
              role="tab"
              tabIndex={selected ? 0 : -1}
              type="button"
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div
        aria-labelledby={`${id}-tab-${toSafeId(activeTab.value)}`}
        className="pt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        id={`${id}-panel-${toSafeId(activeTab.value)}`}
        role="tabpanel"
        tabIndex={0}
      >
        {activeTab.content}
      </div>
    </div>
  );
}
