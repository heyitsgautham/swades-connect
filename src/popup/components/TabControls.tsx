import type { CSSProperties, ReactNode } from 'react';
import { Download, Trash2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ExportFormat } from '../../shared/export';
import { selectStyle } from './controlStyles';

// Controls shared by the Contacts, Opportunities and Activities tabs.

const labelStyle: CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
};

/** A label followed by its inputs on one line. */
export function FilterRow({ label, nowrap, children }: { label: string; nowrap?: boolean; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <label style={nowrap ? { ...labelStyle, whiteSpace: 'nowrap' } : labelStyle}>{label}</label>
      {children}
    </div>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

/** A filter row holding a single select. */
export function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}) {
  return (
    <FilterRow label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={selectStyle}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FilterRow>
  );
}

const exportButtonStyle = (disabled: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '6px 12px',
  border: '1px solid var(--color-border)',
  borderRadius: '0px',
  fontSize: '12px',
  fontWeight: 500,
  background: disabled ? '#f3f4f6' : 'transparent',
  cursor: disabled ? 'not-allowed' : 'pointer',
  color: disabled ? '#9ca3af' : 'var(--color-text)',
  transition: 'all 0.2s ease',
});

const RESTING_SHADOW = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
const HOVER_SHADOW = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';

const deleteAllStyle = (disabled: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  background: disabled ? '#6b7280' : 'linear-gradient(to right, #8B2E2E, #A03535)',
  color: 'white',
  padding: '8px 16px',
  border: 'none',
  borderRadius: '0px',
  fontSize: '13px',
  fontWeight: 600,
  cursor: disabled ? 'not-allowed' : 'pointer',
  boxShadow: disabled ? 'none' : RESTING_SHADOW,
  transition: 'all 0.2s ease',
  transform: 'scale(1)',
});

function ExportButton({
  format,
  disabled,
  onExport,
}: {
  format: ExportFormat;
  disabled: boolean;
  onExport: () => void;
}) {
  return (
    <button
      onClick={onExport}
      disabled={disabled}
      style={exportButtonStyle(disabled)}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = 'var(--color-primary)';
          e.currentTarget.style.color = 'white';
          e.currentTarget.style.borderColor = 'var(--color-primary)';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--color-text)';
          e.currentTarget.style.borderColor = 'var(--color-border)';
        }
      }}
    >
      <Download size={14} /> {format.toUpperCase()}
    </button>
  );
}

/** CSV and JSON export buttons on the left, Delete All on the right. Disabled when there are no records. */
export function ExportBar({
  recordCount,
  onExport,
  onDeleteAll,
}: {
  recordCount: number;
  onExport: (format: ExportFormat) => void;
  onDeleteAll: () => void;
}) {
  const disabled = recordCount === 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <label style={labelStyle}>Export:</label>
      <ExportButton format="csv" disabled={disabled} onExport={() => onExport('csv')} />
      <ExportButton format="json" disabled={disabled} onExport={() => onExport('json')} />

      {/* Spacer to push Delete All to the right */}
      <div style={{ flex: 1 }} />

      <button
        onClick={onDeleteAll}
        disabled={disabled}
        style={deleteAllStyle(disabled)}
        onMouseEnter={(e) => {
          if (!disabled) {
            e.currentTarget.style.transform = 'scale(1.02)';
            e.currentTarget.style.boxShadow = HOVER_SHADOW;
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = disabled ? 'none' : RESTING_SHADOW;
        }}
        onMouseDown={(e) => {
          if (!disabled) e.currentTarget.style.transform = 'scale(0.95)';
        }}
        onMouseUp={(e) => {
          if (!disabled) e.currentTarget.style.transform = 'scale(1.02)';
        }}
      >
        <Trash2 size={18} /> Delete All
      </button>
    </div>
  );
}

/** Placeholder shown when a tab has nothing to list. */
export function EmptyState({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 16px',
        color: 'var(--color-text-secondary)',
      }}
    >
      <Icon size={48} strokeWidth={1.5} style={{ color: '#d1d5db', marginBottom: '12px' }} />
      <p style={{ fontSize: '16px', fontWeight: 500, color: 'var(--color-text)', marginBottom: '4px' }}>{title}</p>
      <p style={{ fontSize: '12px' }}>{hint}</p>
    </div>
  );
}
