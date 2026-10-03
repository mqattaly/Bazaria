import { IconButton } from './IconButton';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  label?: string;
  className?: string;
}

const persianNumber = new Intl.NumberFormat('fa-IR');

export function Pagination({ page, totalPages, onPageChange, label = 'صفحه‌بندی', className }: PaginationProps) {
  const currentPage = totalPages > 0 ? Math.min(Math.max(page, 1), totalPages) : 0;

  return (
    <nav aria-label={label} className={`flex flex-wrap items-center justify-between gap-3 ${className ?? ''}`}>
      <span className="text-xs text-muted">
        صفحه <bdi className="font-semibold text-foreground">{persianNumber.format(currentPage)}</bdi> از{' '}
        <bdi className="font-semibold text-foreground">{persianNumber.format(totalPages)}</bdi>
      </span>
      <div className="flex items-center gap-1.5">
        <IconButton
          disabled={currentPage <= 1}
          icon="chevron-right"
          label="رفتن به صفحهٔ قبل"
          onClick={() => onPageChange(currentPage - 1)}
          size="sm"
          variant="outline"
        />
        <IconButton
          disabled={currentPage === 0 || currentPage >= totalPages}
          icon="chevron-left"
          label="رفتن به صفحهٔ بعد"
          onClick={() => onPageChange(currentPage + 1)}
          size="sm"
          variant="outline"
        />
      </div>
    </nav>
  );
}
