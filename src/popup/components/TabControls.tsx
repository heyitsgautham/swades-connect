import type { ReactNode } from 'react';
import { Download, Trash2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ExportFormat } from '../../shared/export';
import { primaryButtonClassName, selectClassName } from './controlStyles';

// Controls shared by the Contacts, Opportunities and Activities tabs.

const labelClassName = 'text-[12px] font-semibold text-muted';

/** A label followed by its inputs on one line. */
export function FilterRow({ label, nowrap, children }: { label: string; nowrap?: boolean; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <label className={nowrap ? `${labelClassName} whitespace-nowrap` : labelClassName}>{label}</label>
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
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClassName}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FilterRow>
  );
}

function exportButtonClassName(disabled: boolean): string {
  const state = disabled
    ? 'cursor-not-allowed bg-[#f3f4f6] text-[#9ca3af]'
    : 'cursor-pointer bg-transparent text-text hover:border-primary hover:bg-primary hover:text-white';
  return `flex items-center gap-1 border border-border px-3 py-1.5 text-[12px] font-medium [transition:all_0.2s_ease] ${state}`;
}

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
    <button onClick={onExport} disabled={disabled} className={exportButtonClassName(disabled)}>
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
    <div className="flex items-center gap-2">
      <label className={labelClassName}>Export:</label>
      <ExportButton format="csv" disabled={disabled} onExport={() => onExport('csv')} />
      <ExportButton format="json" disabled={disabled} onExport={() => onExport('json')} />

      {/* Spacer to push Delete All to the right */}
      <div className="flex-1" />

      <button onClick={onDeleteAll} disabled={disabled} className={primaryButtonClassName(disabled)}>
        <Trash2 size={18} /> Delete All
      </button>
    </div>
  );
}

/** Placeholder shown when a tab has nothing to list. */
export function EmptyState({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-muted">
      <Icon size={48} strokeWidth={1.5} className="mb-3 text-[#d1d5db]" />
      <p className="mb-1 text-[16px] font-medium text-text">{title}</p>
      <p className="text-[12px]">{hint}</p>
    </div>
  );
}
