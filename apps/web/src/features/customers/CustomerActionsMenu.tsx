import { Icon } from '../../components/icons/Icon';
import { Dropdown, DropdownItem } from '../../components/ui/Dropdown';

interface CustomerActionsMenuProps {
  customerName: string;
  isActive: boolean;
  busy?: boolean;
  onView: () => void;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}

export function CustomerActionsMenu({ customerName, isActive, busy = false, onView, onEdit, onToggleActive, onDelete }: CustomerActionsMenuProps) {
  return (
    <Dropdown label={`عملیات مشتری ${customerName}`} triggerContent={<Icon name="chevron-down" size={18} />}>
      <DropdownItem onSelect={onView}>مشاهدهٔ جزئیات</DropdownItem>
      <DropdownItem disabled={busy} onSelect={onEdit}>ویرایش مشتری</DropdownItem>
      <DropdownItem disabled={busy} onSelect={onToggleActive}>{isActive ? 'غیرفعال کردن' : 'فعال کردن'}</DropdownItem>
      <DropdownItem danger disabled={busy} onSelect={onDelete}>حذف مشتری</DropdownItem>
    </Dropdown>
  );
}
