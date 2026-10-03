import { Icon } from '../../components/icons/Icon';
import { Dropdown, DropdownItem } from '../../components/ui/Dropdown';

interface CategoryActionsMenuProps {
  categoryName: string;
  productCount: number;
  isActive: boolean;
  busy?: boolean;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}

export function CategoryActionsMenu({
  categoryName,
  productCount,
  isActive,
  busy = false,
  onEdit,
  onToggleActive,
  onDelete,
}: CategoryActionsMenuProps) {
  const hasProducts = productCount > 0;

  return (
    <Dropdown label={`عملیات دسته‌بندی ${categoryName}`} triggerContent={<Icon name="chevron-down" size={18} />}>
      <DropdownItem disabled={busy} onSelect={onEdit}>ویرایش دسته‌بندی</DropdownItem>
      <DropdownItem disabled={busy} onSelect={onToggleActive}>{isActive ? 'غیرفعال کردن' : 'فعال کردن'}</DropdownItem>
      <DropdownItem danger disabled={busy || hasProducts} onSelect={onDelete}>
        {hasProducts ? 'حذف ناممکن است؛ ابتدا محصولات را منتقل کنید' : 'حذف دسته‌بندی'}
      </DropdownItem>
    </Dropdown>
  );
}
