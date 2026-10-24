import { describe, expect, it } from 'vitest';
import { extractContacts } from '../contactExtractor';
import { contactKanbanCards, contactListRows, render } from '../../../test/odooDom';

describe('extractContacts from the list view', () => {
  it('reads every row and keys it by the res.partner id in the avatar url', () => {
    render(
      contactListRows([
        {
          partnerId: 42,
          completeName: 'Mira Testwell',
          email: 'mira@example.com',
          phone: '+1 555 0142',
          company: 'Acme Widgets',
          country: 'Testland',
        },
        { partnerId: 43, completeName: 'Omar Sample', email: 'omar@example.org', country: 'Mockovia' },
      ]),
    );

    expect(extractContacts()).toEqual([
      {
        id: 'contact_42',
        name: 'Mira Testwell',
        email: 'mira@example.com',
        phone: '+1 555 0142',
        company: 'Acme Widgets',
        country: 'Testland',
      },
      { id: 'contact_43', name: 'Omar Sample', email: 'omar@example.org', phone: '', company: '', country: 'Mockovia' },
    ]);
  });

  it('takes the company from a "Company, Person" display name when no company column exists', () => {
    render(contactListRows([{ partnerId: 7, completeName: 'Acme Widgets, Mira Testwell' }]));
    expect(extractContacts()[0]).toMatchObject({ name: 'Mira Testwell', company: 'Acme Widgets' });
  });

  it('prefers the explicit company column over the parsed one', () => {
    render(contactListRows([{ partnerId: 7, completeName: 'Old Co, Mira Testwell', company: 'New Co' }]));
    expect(extractContacts()[0].company).toBe('New Co');
  });

  it('falls back to cell text when data-tooltip is missing', () => {
    render(contactListRows([{ partnerId: 9, completeName: 'Text Only', email: 'text@example.com', textOnly: true }]));
    expect(extractContacts()[0]).toMatchObject({ name: 'Text Only', email: 'text@example.com' });
  });

  it('uses a row-index id when the avatar is missing', () => {
    render(contactListRows([{ completeName: 'No Avatar' }, { completeName: 'Also None' }]));
    expect(extractContacts().map((c) => c.id)).toEqual(['contact_idx_0', 'contact_idx_1']);
  });

  it('skips rows without a name', () => {
    render(
      contactListRows([
        { partnerId: 1, completeName: '' },
        { partnerId: 2, completeName: 'Kept' },
      ]),
    );
    expect(extractContacts().map((c) => c.id)).toEqual(['contact_2']);
  });
});

describe('extractContacts from the kanban view', () => {
  it('reads name, icon-labelled fields and the location span after an empty one', () => {
    render(
      contactKanbanCards([
        { partnerId: 50, name: 'Mira Testwell', email: 'mira@example.com', phone: '+1 555 0150', country: 'Testland' },
      ]),
    );

    expect(extractContacts()).toEqual([
      {
        id: 'contact_50',
        name: 'Mira Testwell',
        email: 'mira@example.com',
        phone: '+1 555 0150',
        company: '',
        country: 'Testland',
      },
    ]);
  });

  it('reads the company from the parent_id field or the display name', () => {
    render(
      contactKanbanCards([
        { partnerId: 51, name: 'Omar Sample', company: 'Globex Test' },
        { partnerId: 52, name: 'Initech Demo, Pat Example' },
      ]),
    );

    const [first, second] = extractContacts();
    expect(first.company).toBe('Globex Test');
    expect(second).toMatchObject({ name: 'Pat Example', company: 'Initech Demo' });
  });

  it('returns nothing on a page with neither view', () => {
    render('<div class="o_form_view"></div>');
    expect(extractContacts()).toEqual([]);
  });
});
