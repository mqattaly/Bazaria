import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from 'react';
import { IconButton } from './IconButton';
import { cn } from '../../lib/cn';

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  variant?: 'dialog' | 'drawer';
  className?: string;
  closeLabel?: string;
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  variant = 'dialog',
  className,
  closeLabel = 'بستن پنجره',
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
    }
  }, [open]);

  function closeDialog(): void {
    const dialog = dialogRef.current;
    if (dialog?.open && typeof dialog.close === 'function') {
      dialog.close();
      return;
    }
    dialog?.removeAttribute('open');
    onOpenChange(false);
    previousFocus.current?.focus();
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>): void {
    if (event.target === event.currentTarget) closeDialog();
  }

  return (
    <dialog
      aria-describedby={description ? descriptionId : undefined}
      aria-labelledby={titleId}
      className={cn('bazariya-dialog fixed max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-visible bg-transparent text-foreground backdrop:bg-overlay', className)}
      data-variant={variant}
      dir="rtl"
      onCancel={(event) => {
        event.preventDefault();
        closeDialog();
      }}
      onClick={handleBackdropClick}
      onClose={() => {
        onOpenChange(false);
        previousFocus.current?.focus();
      }}
      ref={dialogRef}
    >
      <section className={cn('flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-dialog', variant === 'drawer' && 'h-full max-h-full rounded-none border-0')}>
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-foreground" id={titleId}>{title}</h2>
            {description ? <p className="mt-1 text-xs leading-5 text-muted" id={descriptionId}>{description}</p> : null}
          </div>
          <IconButton icon="close" label={closeLabel} onClick={closeDialog} size="sm" />
        </header>
        <div className="min-h-0 overflow-y-auto p-4 sm:p-5">{children}</div>
      </section>
    </dialog>
  );
}
