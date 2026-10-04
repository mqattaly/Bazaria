import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { CreateStockMovementInput, InventoryItem, StockMovementType } from '@bazariya/shared';
import { Button, Input, Modal, Textarea } from '../../components/ui';
import { PRODUCT_UNIT_LABELS } from '../catalog/catalog.constants';
import { inventoryNumber, movementTypeLabels } from './inventory.constants';

interface StockMovementDialogProps {
  item: InventoryItem;
  type: StockMovementType;
  open: boolean;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: CreateStockMovementInput) => Promise<void>;
}

function normalizeDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[\s,٬]/g, '');
}

export function parseStockQuantity(value: string): number | null {
  const normalized = normalizeDigits(value);
  if (!/^\d+$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function StockMovementDialog({ item, type, open, saving, onOpenChange, onSave }: StockMovementDialogProps) {
  const [quantityText, setQuantityText] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setQuantityText('');
    setNote('');
    setFormError(undefined);
  }, [item.product.id, open, type]);

  const quantity = useMemo(() => parseStockQuantity(quantityText), [quantityText]);
  const quantityError = useMemo(() => {
    if (!quantityText.trim()) return undefined;
    if (quantity === null) return 'یک عدد صحیح نامنفی وارد کنید.';
    if ((type === 'IN' || type === 'OUT') && quantity === 0) return 'برای ورود و خروج، تعداد باید بیشتر از صفر باشد.';
    if (type === 'OUT' && quantity > item.quantity) return 'موجودی فعلی برای این خروج کافی نیست.';
    if (type === 'IN' && !Number.isSafeInteger(item.quantity + quantity)) return 'موجودی جدید از حد مجاز بیشتر می‌شود.';
    return undefined;
  }, [item.quantity, quantity, quantityText, type]);

  const resultingQuantity = quantityError || quantity === null
    ? null
    : type === 'IN'
      ? item.quantity + quantity
      : type === 'OUT'
        ? item.quantity - quantity
        : quantity;

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (quantityError || quantity === null) return;
    setFormError(undefined);
    const input: CreateStockMovementInput = {
      type,
      quantity,
      note: note.trim() || null,
    };
    try {
      await onSave(input);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'ثبت گردش موجودی انجام نشد. دوباره تلاش کنید.');
    }
  }

  const quantityLabel = type === 'ADJUSTMENT' ? 'موجودی نهایی' : 'تعداد';
  const submitLabel = type === 'IN' ? 'ثبت ورود' : type === 'OUT' ? 'ثبت خروج' : 'ثبت اصلاح';

  return (
    <Modal
      description={`ثبت گردش برای ${item.product.name}؛ مقدار قبل و بعد به‌صورت خودکار ثبت می‌شود.`}
      onOpenChange={onOpenChange}
      open={open}
      title={movementTypeLabels[type]}
    >
      <form className="grid gap-4" onSubmit={(event) => { void submit(event); }}>
        <Input
          autoComplete="off"
          autoFocus
          error={quantityError}
          inputMode="numeric"
          label={quantityLabel}
          onChange={(event) => {
            setQuantityText(event.currentTarget.value);
            setFormError(undefined);
          }}
          placeholder="برای نمونه: ۱۲"
          type="text"
          value={quantityText}
        />
        <p className="-mt-2 text-xs text-muted">
          واحد کالا: <span className="font-semibold text-foreground">{PRODUCT_UNIT_LABELS[item.product.unit]}</span>
        </p>
        <Textarea
          label="یادداشت (اختیاری)"
          maxLength={500}
          onChange={(event) => setNote(event.currentTarget.value)}
          placeholder="دلیل یا توضیح کوتاه"
          rows={3}
          value={note}
        />
        {resultingQuantity !== null ? (
          <div className="rounded-xl border border-border bg-surface-muted px-3.5 py-3 text-sm" role="status">
            موجودی پس از ثبت:{' '}
            <strong className="text-foreground">{inventoryNumber.format(resultingQuantity)} {PRODUCT_UNIT_LABELS[item.product.unit]}</strong>
            <span className="mx-1 text-muted">(از {inventoryNumber.format(item.quantity)})</span>
          </div>
        ) : null}
        {formError ? <p className="text-sm text-danger" role="alert">{formError}</p> : null}
        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Button onClick={() => onOpenChange(false)} variant="outline">انصراف</Button>
          <Button disabled={quantity === null || Boolean(quantityError) || saving} loading={saving} type="submit">{submitLabel}</Button>
        </div>
      </form>
    </Modal>
  );
}
