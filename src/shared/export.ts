import type { DataType } from './schemas';
import type { Contact, Opportunity, Activity } from './types';

export type ExportFormat = 'csv' | 'json';
type Row = Record<string, string | number | undefined>;

function toCSV(rows: Row[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (val: string | number | undefined) => {
    const s = val === undefined ? '' : String(val);
    const needsQuote = s.includes(',') || s.includes('"') || s.includes('\n');
    const escaped = s.replace(/"/g, '""');
    return needsQuote ? `"${escaped}"` : escaped;
  };
  const csvRows = [headers.join(',')];
  for (const row of rows) {
    csvRows.push(headers.map((h) => escape(row[h])).join(','));
  }
  return csvRows.join('\n');
}

export function exportCSV(type: DataType, data: Contact[] | Opportunity[] | Activity[]): string {
  switch (type) {
    case 'contacts':
      return toCSV(
        (data as Contact[]).map((c) => ({
          id: c.id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          company: c.company,
          country: c.country,
        })),
      );
    case 'opportunities':
      return toCSV(
        (data as Opportunity[]).map((o) => ({
          id: o.id,
          name: o.name,
          stage: o.stage,
          revenue: `₹${o.revenue.toLocaleString('en-IN')}`,
          probability: o.probability,
          closeDate: o.closeDate,
        })),
      );
    case 'activities':
      return toCSV(
        (data as Activity[]).map((a) => ({
          id: a.id,
          summary: a.summary,
          type: a.type,
          status: a.status,
          dueDate: a.dueDate,
          assignedTo: a.assignedTo,
        })),
      );
    default:
      return '';
  }
}

export function exportJSON(_type: DataType, data: Contact[] | Opportunity[] | Activity[]): string {
  return JSON.stringify(data, null, 2);
}

export function exportData(type: DataType, data: Contact[] | Opportunity[] | Activity[], format: ExportFormat): string {
  return format === 'csv' ? exportCSV(type, data) : exportJSON(type, data);
}

/** File name and MIME type for a download, for example swades-contacts-1768903200000.csv. */
export function exportFile(type: DataType, format: ExportFormat, now = Date.now()): { filename: string; mime: string } {
  return {
    filename: `swades-${type}-${now}.${format}`,
    mime: format === 'csv' ? 'text/csv' : 'application/json',
  };
}
