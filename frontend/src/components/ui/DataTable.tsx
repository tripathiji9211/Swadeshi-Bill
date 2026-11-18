import React from 'react';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  header: string;
  align?: 'left' | 'center' | 'right';
  render?: (row: T, index: number) => React.ReactNode;
  width?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor?: (row: T, index: number) => string;
  className?: string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  keyExtractor = (_, i) => String(i),
  className,
  onRowClick,
  emptyMessage = 'NO_DATA_LOGGED',
}: DataTableProps<T>) {
  return (
    <div
      className={cn(
        'w-full overflow-x-auto border border-[#1C1C1F] rounded bg-[#0A0A0A]',
        className
      )}
    >
      <table className="w-full text-left border-collapse text-xs">
        <thead className="bg-[#0A0A0A] border-b border-[#1C1C1F]">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{ width: col.width }}
                className={cn(
                  'py-2.5 px-3 font-mono text-[10px] tracking-[0.12em] uppercase text-[#52555C] font-normal select-none',
                  col.align === 'right' && 'text-right',
                  col.align === 'center' && 'text-center'
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1C1C1F]">
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="py-8 text-center font-mono text-xs text-[#52555C] uppercase tracking-wider"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr
                key={keyExtractor(row, index)}
                onClick={() => onRowClick && onRowClick(row)}
                className={cn(
                  'transition-colors duration-150',
                  onRowClick
                    ? 'cursor-pointer hover:bg-[#111111]'
                    : 'hover:bg-[#111111]/50'
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      'py-2.5 px-3 text-[#EDEDED] font-mono text-xs tabular-nums',
                      col.align === 'right' && 'text-right',
                      col.align === 'center' && 'text-center'
                    )}
                  >
                    {col.render ? col.render(row, index) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;

