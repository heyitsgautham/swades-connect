import { Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import type { Contact, Opportunity, Activity } from '../../shared/types';

// Union type for all supported row types
type DataRow = Contact | Opportunity | Activity;

// Helper to get a value from a row by key (handles dynamic property access)
function getRowValue(row: DataRow, key: string): string | number | boolean | null | undefined {
  return (row as unknown as Record<string, string | number | boolean | null | undefined>)[key];
}

// Helper to get display name for confirmation
function getRowDisplayName(row: DataRow): string {
  if ('name' in row && row.name) return row.name;
  if ('summary' in row && row.summary) return row.summary;
  return row.id;
}

interface Column {
  key: string;
  label: string;
  format?: (value: string | number | boolean | null | undefined) => string;
  sortable?: boolean;
  width?: string;
}

interface DataTableProps {
  columns: Column[];
  data: DataRow[];
  onDelete: (id: string) => void;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: string) => void;
}

function DataTable({ columns, data, onDelete, sortKey, sortDirection, onSort }: DataTableProps) {
  return (
    <div className="overflow-hidden border border-border">
      <table className="w-full table-fixed border-collapse text-[12px]">
        <thead>
          <tr className="border-b-2 border-border bg-accent">
            {columns.map((col) => {
              const isSortable = col.sortable !== false && onSort;
              const isActive = sortKey === col.key;
              return (
                <th
                  key={col.key}
                  onClick={() => isSortable && onSort(col.key)}
                  className={`truncate p-2 text-left font-semibold text-text select-none [transition:background_0.15s_ease] ${
                    isSortable ? 'cursor-pointer hover:bg-[rgba(151,49,49,0.08)]' : 'cursor-default'
                  }`}
                  style={{ width: col.width || 'auto' }}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {isSortable &&
                      isActive &&
                      (sortDirection === 'asc' ? (
                        <ArrowUp size={12} className="text-primary" />
                      ) : (
                        <ArrowDown size={12} className="text-primary" />
                      ))}
                  </span>
                </th>
              );
            })}
            <th className="w-10 p-2 text-center font-semibold text-text">Action</th>
          </tr>
        </thead>
        <tbody>
          {/* Row hover comes from the tbody tr:hover rule in App.css. */}
          {data.map((row, index) => (
            <tr
              key={row.id}
              className={`border-b border-border [transition:background_0.15s_ease] ${
                index % 2 === 1 ? 'bg-[rgba(255,244,219,0.3)]' : 'bg-transparent'
              }`}
            >
              {columns.map((col) => {
                const cellValue = getRowValue(row, col.key);
                return (
                  <td
                    key={`${row.id}-${col.key}`}
                    title={String(cellValue ?? '')}
                    className="max-w-[120px] truncate px-2 py-3"
                  >
                    {col.format ? col.format(cellValue) : (cellValue ?? '')}
                  </td>
                );
              })}
              <td className="p-2 text-center">
                <button
                  onClick={() => {
                    if (window.confirm(`Delete "${getRowDisplayName(row)}"?`)) {
                      onDelete(row.id);
                    }
                  }}
                  title="Delete this record"
                  className="flex cursor-pointer items-center justify-center rounded-full bg-transparent p-1.5 text-[#9ca3af] [transition:all_0.2s_ease] hover:bg-[#fef2f2] hover:text-[#dc2626]"
                >
                  <Trash2 size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
