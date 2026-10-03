import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface DropdownProps {
  label: string;
  triggerContent: ReactNode;
  children: ReactNode;
  align?: 'start' | 'end';
  className?: string;
}

export function Dropdown({ label, triggerContent, children, align = 'end', className }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function closeOnOutsidePointer(event: PointerEvent): void {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [open]);

  function focusMenuItem(index: number): void {
    const items = rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)');
    if (!items?.length) return;
    const boundedIndex = Math.max(0, Math.min(index, items.length - 1));
    items[boundedIndex]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const items = Array.from(rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);

    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (event.key === 'ArrowDown' && event.target === triggerRef.current) {
      event.preventDefault();
      if (!open) setOpen(true);
      requestAnimationFrame(() => focusMenuItem(0));
    } else if (event.key === 'ArrowDown' && currentIndex >= 0) {
      event.preventDefault();
      focusMenuItem((currentIndex + 1) % items.length);
    } else if (event.key === 'ArrowUp' && currentIndex >= 0) {
      event.preventDefault();
      focusMenuItem((currentIndex - 1 + items.length) % items.length);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusMenuItem(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusMenuItem(items.length - 1);
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  }

  return (
    <div className={cn('relative inline-flex', className)} onKeyDown={handleKeyDown} ref={rootRef}>
      <button
        aria-controls={menuId}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        className="inline-flex min-h-11 items-center justify-center rounded-xl text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        onClick={() => setOpen((current) => !current)}
        ref={triggerRef}
        type="button"
      >
        {triggerContent}
      </button>
      {open ? (
        <div
          aria-label={label}
          className={cn(
            'absolute top-full z-50 mt-2 min-w-52 rounded-2xl border border-border bg-surface p-1.5 shadow-popover',
            align === 'start' ? 'start-0' : 'end-0',
          )}
          id={menuId}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest('[role="menuitem"]')) setOpen(false);
          }}
          role="menu"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

interface DropdownItemProps {
  children: ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  danger?: boolean;
}

export function DropdownItem({ children, onSelect, disabled = false, danger = false }: DropdownItemProps) {
  return (
    <button
      className={cn(
        'flex min-h-10 w-full items-center rounded-xl px-3 text-sm transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
        danger ? 'text-danger' : 'text-foreground',
        'disabled:cursor-not-allowed disabled:opacity-50',
      )}
      disabled={disabled}
      onClick={onSelect}
      role="menuitem"
      tabIndex={-1}
      type="button"
    >
      {children}
    </button>
  );
}
