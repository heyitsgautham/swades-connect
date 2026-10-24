import { describe, expect, it } from 'vitest';
import {
  convertRecord,
  convertToActivity,
  convertToContact,
  convertToOpportunity,
  extractMany2oneName,
  mapModelToDataType,
  recordsFromReadGroup,
  recordsFromSave,
  recordsFromSearchRead,
  sanitizeOdooValue,
} from '../odooRecords';

describe('mapModelToDataType', () => {
  it.each([
    ['res.partner', 'contacts'],
    ['crm.lead', 'opportunities'],
    ['mail.activity', 'activities'],
    ['mail.activity.schedule', 'activities'],
    ['sale.order', null],
  ])('maps %s to %s', (model, expected) => {
    expect(mapModelToDataType(model)).toBe(expected);
  });
});

describe('sanitizeOdooValue', () => {
  it('replaces false, null and undefined with the default', () => {
    expect(sanitizeOdooValue(false, 'x')).toBe('x');
    expect(sanitizeOdooValue(null, 0)).toBe(0);
    expect(sanitizeOdooValue(undefined, '')).toBe('');
  });

  it('keeps real values, including 0 and empty strings', () => {
    expect(sanitizeOdooValue(0, 5)).toBe(0);
    expect(sanitizeOdooValue('', 'x')).toBe('');
  });
});

describe('extractMany2oneName', () => {
  it.each([
    [[3, 'Testland'], 'Testland'],
    [{ id: 3, display_name: 'Testland' }, 'Testland'],
    [{ id: 3, name: 'Mockovia' }, 'Mockovia'],
    ['Plain', 'Plain'],
    [false, ''],
    [[3], ''],
    [{ id: 3 }, ''],
    [42, ''],
  ])('reads %j as %j', (value, expected) => {
    expect(extractMany2oneName(value)).toBe(expected);
  });
});

describe('convertToContact', () => {
  it('maps a web_search_read partner record', () => {
    expect(
      convertToContact({
        id: 12,
        name: 'Mira Testwell',
        email: 'mira@example.com',
        phone: false,
        mobile: '+1 555 0112',
        parent_id: [4, 'Acme Widgets'],
        country_id: { id: 9, display_name: 'Testland' },
      }),
    ).toEqual({
      id: 'contact_12',
      name: 'Mira Testwell',
      email: 'mira@example.com',
      phone: '+1 555 0112',
      company: 'Acme Widgets',
      country: 'Testland',
    });
  });

  it('prefers company_name, then parent_id, then parent_name', () => {
    expect(convertToContact({ id: 1, name: 'A', company_name: 'Direct', parent_id: [2, 'Parent'] }).company).toBe(
      'Direct',
    );
    expect(convertToContact({ id: 1, name: 'A', parent_name: 'By name' }).company).toBe('By name');
  });

  it('splits complete_name when there is no explicit name', () => {
    expect(convertToContact({ id: 5, name: false, complete_name: 'Globex Test, Omar Sample' })).toMatchObject({
      name: 'Omar Sample',
      company: 'Globex Test',
    });
  });

  it('falls back to display_name', () => {
    expect(convertToContact({ id: 6, display_name: 'Shown Name' }).name).toBe('Shown Name');
  });
});

describe('convertToOpportunity', () => {
  it('maps an edit response with an object stage', () => {
    expect(
      convertToOpportunity({
        id: 30,
        name: 'Widget bulk order',
        expected_revenue: 12500,
        stage_id: { id: 2, display_name: 'Qualified' },
        probability: 40,
        date_deadline: '2026-03-31',
      }),
    ).toEqual({
      id: 'opp_30',
      name: 'Widget bulk order',
      revenue: 12500,
      stage: 'Qualified',
      probability: 40,
      closeDate: '2026-03-31',
    });
  });

  it('reads tuple and bare-number stages', () => {
    expect(convertToOpportunity({ id: 1, stage_id: [2, 'Won'] }).stage).toBe('Won');
    expect(convertToOpportunity({ id: 1, stage_id: 4 }).stage).toBe('Stage 4');
  });

  it('defaults false fields', () => {
    expect(convertToOpportunity({ id: 2, name: 'Bare', expected_revenue: false, date_deadline: false })).toMatchObject({
      revenue: 0,
      probability: 0,
      closeDate: '',
      stage: '',
    });
  });
});

describe('convertToActivity', () => {
  it('maps a web_search_read activity record', () => {
    expect(
      convertToActivity({
        id: 70,
        summary: 'Follow up on quote',
        activity_type_id: [1, 'Phone Call'],
        user_id: { id: 2, display_name: 'Sam Placeholder' },
        date_deadline: '2026-02-14',
        state: 'planned',
      }),
    ).toEqual({
      id: 'act_70',
      type: 'call',
      summary: 'Follow up on quote',
      dueDate: '2026-02-14',
      assignedTo: 'Sam Placeholder',
      status: 'open',
    });
  });

  it('uses the same type mapping as the DOM extractor', () => {
    expect(convertToActivity({ id: 1, activity_type_id: [3, 'Meeting'] }).type).toBe('meeting');
    expect(convertToActivity({ id: 1, activity_type_id: { display_name: 'Email' } }).type).toBe('email');
    expect(convertToActivity({ id: 1, activity_type_id: false }).type).toBe('todo');
  });

  it('prefers activity_user_id from the schedule wizard and falls back to note', () => {
    expect(
      convertToActivity({
        id: 1,
        summary: false,
        note: 'From note',
        activity_user_id: [5, 'Pat Example'],
        user_id: [6, 'Other'],
      }),
    ).toMatchObject({ summary: 'From note', assignedTo: 'Pat Example' });
  });

  it('marks done activities', () => {
    expect(convertToActivity({ id: 1, state: 'done' }).status).toBe('done');
  });
});

describe('convertRecord', () => {
  it('dispatches on data type', () => {
    expect(convertRecord('contacts', { id: 1 }).id).toBe('contact_1');
    expect(convertRecord('opportunities', { id: 1 }).id).toBe('opp_1');
    expect(convertRecord('activities', { id: 1 }).id).toBe('act_1');
  });
});

describe('RPC result unpacking', () => {
  it('recordsFromSearchRead reads the records array and ignores anything else', () => {
    expect(recordsFromSearchRead({ length: 2, records: [{ id: 1 }, { id: 2 }] })).toEqual([{ id: 1 }, { id: 2 }]);
    expect(recordsFromSearchRead({ length: 0 })).toEqual([]);
    expect(recordsFromSearchRead(null)).toEqual([]);
  });

  it('recordsFromReadGroup flattens every group', () => {
    expect(
      recordsFromReadGroup({
        groups: [
          { stage_id: [1, 'New'], __records: [{ id: 1 }] },
          { stage_id: [2, 'Won'], __records: [{ id: 2 }, { id: 3 }] },
          { stage_id: [3, 'Lost'] },
        ],
      }),
    ).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(recordsFromReadGroup({})).toEqual([]);
  });

  it('recordsFromSave merges args[1] into id-only results', () => {
    expect(recordsFromSave([[], { name: 'New deal', expected_revenue: 10 }], [{ id: 41 }])).toEqual([
      { id: 41, name: 'New deal', expected_revenue: 10 },
    ]);
  });

  it('recordsFromSave returns full saved records as they are', () => {
    const saved = { id: 41, name: 'Edited deal', stage_id: [2, 'Won'] };
    expect(recordsFromSave([[41], { stage_id: 2 }], [saved])).toEqual([saved]);
    expect(recordsFromSave([[41], {}], saved)).toEqual([saved]);
  });

  it('recordsFromSave yields nothing for a bare id or a boolean', () => {
    expect(recordsFromSave([{ name: 'x' }], 41)).toEqual([]);
    expect(recordsFromSave([[41], { name: 'x' }], true)).toEqual([]);
  });
});
