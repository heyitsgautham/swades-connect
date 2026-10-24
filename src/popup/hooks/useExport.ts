import { downloadFile } from '../../shared/download';
import { exportData, exportFile, type ExportFormat, type ExportType } from '../../shared/export';
import type { Activity, Contact, Opportunity } from '../../shared/types';
import { useToast } from './useToast';

/** Download every record of one type as CSV or JSON and confirm with a toast. */
export function useExport(type: ExportType, records: Contact[] | Opportunity[] | Activity[]) {
  const { showToast } = useToast();

  return (format: ExportFormat) => {
    const { filename, mime } = exportFile(type, format);
    downloadFile(filename, exportData(type, records, format), mime);
    showToast({ type: 'success', message: `Exported ${records.length} ${type} as ${format.toUpperCase()}` });
  };
}
