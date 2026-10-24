import { describe, expect, it } from 'vitest';
import { exportCSV, exportData, exportJSON } from '../export';
import { makeActivity, makeContact, makeOpportunity } from '../../test/fixtures';

describe('exportCSV', () => {
  it('writes a header and one row per contact', () => {
    expect(exportCSV('contacts', [makeContact({ id: 'contact_1', phone: '' })])).toBe(
      'id,name,email,phone,company,country\ncontact_1,Mira Testwell,mira.testwell@example.com,,Acme Widgets,Testland',
    );
  });

  it('quotes commas, quotes and newlines', () => {
    const csv = exportCSV('contacts', [makeContact({ name: 'Testwell, Mira', company: 'The "Acme" Co', country: 'Line\nBreak' })]);
    expect(csv.split('\n').slice(1).join('\n')).toBe(
      'contact_101,"Testwell, Mira",mira.testwell@example.com,+1 555 0101,"The ""Acme"" Co","Line\nBreak"',
    );
  });

  it('formats opportunity revenue in rupees with Indian grouping', () => {
    const [, row] = exportCSV('opportunities', [makeOpportunity({ revenue: 1250000 })]).split('\n');
    expect(row).toBe('opp_201,Widget bulk order,Qualified,"₹12,50,000",40,2026-03-31');
  });

  it('orders activity columns for reading', () => {
    expect(exportCSV('activities', [makeActivity()]).split('\n')[0]).toBe('id,summary,type,status,dueDate,assignedTo');
  });

  it('returns an empty string for no records', () => {
    expect(exportCSV('contacts', [])).toBe('');
  });
});

describe('exportJSON and exportData', () => {
  it('pretty-prints JSON', () => {
    const data = [makeActivity()];
    expect(exportJSON('activities', data)).toBe(JSON.stringify(data, null, 2));
  });

  it('dispatches on format', () => {
    const data = [makeContact()];
    expect(exportData('contacts', data, 'csv')).toBe(exportCSV('contacts', data));
    expect(exportData('contacts', data, 'json')).toBe(exportJSON('contacts', data));
  });
});
