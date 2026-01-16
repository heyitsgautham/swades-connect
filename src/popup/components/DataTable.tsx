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
    <div style={{
      overflow: 'hidden',
      border: '1px solid var(--color-border)',
      borderRadius: '0px',
    }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '12px',
        tableLayout: 'fixed',
      }}>
        <thead>
          <tr style={{
            background: 'var(--color-accent)',
            borderBottom: '2px solid var(--color-border)',
          }}>
            {columns.map((col) => {
              const isSortable = col.sortable !== false && onSort;
              const isActive = sortKey === col.key;
              return (
                <th
                  key={col.key}
                  onClick={() => isSortable && onSort(col.key)}
                  style={{
                    padding: '8px',
                    textAlign: 'left',
                    fontWeight: 600,
                    color: 'var(--color-text)',
                    cursor: isSortable ? 'pointer' : 'default',
                    userSelect: 'none',
                    transition: 'background 0.15s ease',
                    width: col.width || 'auto',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => {
                    if (isSortable) {
                      e.currentTarget.style.background = 'rgba(151, 49, 49, 0.08)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {col.label}
                    {isSortable && isActive && (
                      sortDirection === 'asc' 
                        ? <ArrowUp size={12} style={{ color: 'var(--color-primary)' }} />
                        : <ArrowDown size={12} style={{ color: 'var(--color-primary)' }} />
                    )}
                  </span>
                </th>
              );
            })}
            <th style={{
              padding: '8px',
              textAlign: 'center',
              fontWeight: 600,
              color: 'var(--color-text)',
              width: '40px',
            }}>
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr 
              key={row.id} 
              style={{ 
                borderBottom: '1px solid var(--color-border)',
                background: index % 2 === 1 ? 'rgba(255, 244, 219, 0.3)' : 'transparent',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(151, 49, 49, 0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = index % 2 === 1 ? 'rgba(255, 244, 219, 0.3)' : 'transparent';
              }}
            >
              {columns.map((col) => {
                const cellValue = getRowValue(row, col.key);
                return (
                <td
                  key={`${row.id}-${col.key}`}
                  title={String(cellValue ?? '')}
                  style={{
                    padding: '12px 8px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '120px',
                  }}
                >
                  {col.format ? col.format(cellValue) : (cellValue ?? '')}
                </td>
              );
              })}
              <td style={{ textAlign: 'center', padding: '8px' }}>
                <button
                  onClick={() => {
                    if (window.confirm(`Delete "${getRowDisplayName(row)}"?`)) {
                      onDelete(row.id);
                    }
                  }}
                  title="Delete this record"
                  style={{
                    padding: '6px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '9999px',
                    cursor: 'pointer',
                    color: '#9ca3af',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#dc2626';
                    e.currentTarget.style.background = '#fef2f2';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#9ca3af';
                    e.currentTarget.style.background = 'transparent';
                  }}
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
