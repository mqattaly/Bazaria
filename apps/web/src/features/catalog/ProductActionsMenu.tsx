import { Icon } from '../../components/icons/Icon';
import { Dropdown, DropdownItem } from '../../components/ui/Dropdown';

interface ProductActionsMenuProps {
  productName: string;
  isActive: boolean;
  busy?: boolean;
  onView: () => void;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}

export function ProductActionsMenu({ productName, isActive, busy = false, onView, onEdit, onToggleActive, onDelete }: ProductActionsMenuProps) {
  return (
    <Dropdown label={`عملیات محصول ${productName}`} triggerContent={<Icon name="chevron-down" size={18} />}>
      <DropdownItem onSelect={onView}>مشاهدهٔ جزئیات</DropdownItem>
      <DropdownItem disabled={busy} onSelect={onEdit}>ویرایش محصول</DropdownItem>
      <DropdownItem disabled={busy} onSelect={onToggleActive}>{isActive ? 'غیرفعال کردن' : 'فعال کردن'}</DropdownItem>
      <DropdownItem danger disabled={busy} onSelect={onDelete}>حذف محصول</DropdownItem>
    </Dropdown>
  );
}
