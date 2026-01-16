import { Trash2 } from 'lucide-react';

interface Column {
  key: string;
  label: string;
  format?: (value: any) => string;
}

interface DataTableProps {
  columns: Column[];
  data: any[];
  onDelete: (id: string) => void;
}

function DataTable({ columns, data, onDelete }: DataTableProps) {
  return (
    <div style={{
      overflowX: 'auto',
      border: '1px solid var(--color-border)',
      borderRadius: '0px',
    }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '12px',
      }}>
        <thead>
          <tr style={{
            background: 'var(--color-accent)',
            borderBottom: '2px solid var(--color-border)',
          }}>
            {columns.map((col) => (
              <th key={col.key} style={{
                padding: '8px',
                textAlign: 'left',
                fontWeight: 600,
                color: 'var(--color-text)',
              }}>
                {col.label}
              </th>
            ))}
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
              {columns.map((col) => (
                <td
                  key={`${row.id}-${col.key}`}
                  title={String(row[col.key] ?? '')}
                  style={{
                    padding: '12px 8px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '120px',
                  }}
                >
                  {col.format ? col.format(row[col.key]) : (row[col.key] ?? '')}
                </td>
              ))}
              <td style={{ textAlign: 'center', padding: '8px' }}>
                <button
                  onClick={() => {
                    if (window.confirm(`Delete "${row.name || row.summary}"?`)) {
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
