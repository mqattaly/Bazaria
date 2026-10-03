import type { ReactNode } from 'react';
import { EmptyState } from './EmptyState';
import { LoadingState } from './LoadingState';

export interface TableColumn<Row> {
  id: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  align?: 'start' | 'center' | 'end';
  className?: string;
}

interface TableProps<Row> {
  ariaLabel: string;
  columns: readonly TableColumn<Row>[];
  rows: readonly Row[];
  getRowId: (row: Row) => string | number;
  caption?: string;
  loading?: boolean;
  emptyState?: ReactNode;
  className?: string;
}

const alignments = {
  start: 'text-start',
  center: 'text-center',
  end: 'text-end',
} satisfies Record<NonNullable<TableColumn<unknown>['align']>, string>;

export function Table<Row>({
  ariaLabel,
  columns,
  rows,
  getRowId,
  caption,
  loading = false,
  emptyState,
  className,
}: TableProps<Row>) {
  return (
    <div aria-label={ariaLabel} className="overflow-x-auto rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" role="region" tabIndex={0}>
      <table className={`w-full min-w-[38rem] border-collapse text-sm ${className ?? ''}`}>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead className="bg-surface-muted text-xs font-semibold text-muted">
          <tr>
            {columns.map((column) => (
              <th className={`whitespace-nowrap px-4 py-3 ${alignments[column.align ?? 'start']} ${column.className ?? ''}`} key={column.id} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {loading ? (
            <tr><td className="p-2" colSpan={columns.length}><LoadingState compact /></td></tr>
          ) : rows.length > 0 ? (
            rows.map((row) => (
              <tr className="transition-colors hover:bg-surface-muted/70" key={getRowId(row)}>
                {columns.map((column) => (
                  <td className={`whitespace-nowrap px-4 py-3.5 text-foreground ${alignments[column.align ?? 'start']} ${column.className ?? ''}`} key={column.id}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td className="p-2" colSpan={Math.max(columns.length, 1)}>
                {emptyState ?? <EmptyState compact description="پس از ثبت اطلاعات، موارد این بخش نمایش داده می‌شوند." title="موردی برای نمایش نیست" />}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
