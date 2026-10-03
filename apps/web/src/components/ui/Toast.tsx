import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from '../icons/Icon';
import { IconButton } from './IconButton';
import { cn } from '../../lib/cn';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ToastMessage {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastInput {
  title: string;
  description?: string;
}

export interface ToastApi {
  show: (input: ToastInput & { variant: ToastVariant }) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const variants: Record<ToastVariant, { icon: IconName; className: string }> = {
  success: { icon: 'check', className: 'border-success/25 bg-success-soft text-success' },
  error: { icon: 'alert', className: 'border-danger/25 bg-danger-soft text-danger' },
  warning: { icon: 'alert', className: 'border-warning/25 bg-warning-soft text-warning' },
  info: { icon: 'info', className: 'border-info/25 bg-info-soft text-info' },
};

interface ToastNoticeProps extends ToastMessage {
  onDismiss: (id: number) => void;
}

export function Toast({ id, title, description, variant, onDismiss }: ToastNoticeProps) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(id), 5_000);
    return () => window.clearTimeout(timer);
  }, [id, onDismiss]);

  const style = variants[variant];
  return (
    <article
      aria-atomic="true"
      className={cn('pointer-events-auto flex items-start gap-3 rounded-2xl border p-3.5 shadow-popover', style.className)}
      role={variant === 'error' ? 'alert' : 'status'}
    >
      <Icon className="mt-0.5 shrink-0" name={style.icon} size={18} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{title}</p>
        {description ? <p className="mt-0.5 text-xs leading-5 opacity-90">{description}</p> : null}
      </div>
      <IconButton
        className="-me-1 -mt-1 text-current hover:bg-surface-muted/70"
        icon="close"
        label="بستن اعلان"
        onClick={() => onDismiss(id)}
        size="sm"
      />
    </article>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);
  const sequence = useRef(0);
  const dismiss = useCallback((id: number) => setMessages((current) => current.filter((message) => message.id !== id)), []);
  const show = useCallback((input: ToastInput & { variant: ToastVariant }) => {
    const id = ++sequence.current;
    setMessages((current) => [...current, { ...input, id }].slice(-4));
  }, []);

  const api = useMemo<ToastApi>(() => ({
    show,
    success: (title, description) => show({ title, description, variant: 'success' }),
    error: (title, description) => show({ title, description, variant: 'error' }),
    warning: (title, description) => show({ title, description, variant: 'warning' }),
    info: (title, description) => show({ title, description, variant: 'info' }),
  }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-label="اعلان‌ها" className="pointer-events-none fixed inset-inline-end-3 top-3 z-[100] flex w-[min(24rem,calc(100vw-1.5rem))] flex-col gap-2" dir="rtl">
        {messages.map((message) => <Toast key={message.id} {...message} onDismiss={dismiss} />)}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
