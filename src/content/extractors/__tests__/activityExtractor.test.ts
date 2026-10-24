import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extractActivities } from '../activityExtractor';
import { clearActivityIdCache, populateActivityIdCache } from '../../idCache';
import { generateContentHash } from '../../parsing';
import { activityKanbanCards, activityListRows, render } from '../../../test/odooDom';

beforeEach(() => {
  clearActivityIdCache();
});

describe('extractActivities from the list view', () => {
  it('reads summary, mapped type, user, titled due date and status', async () => {
    render(
      activityListRows([
        { summary: 'Follow up on quote', type: 'Call', user: 'Sam Placeholder', deadlineTitle: '14/02/2026' },
        { summary: 'Send brochure', type: 'Email', user: 'Sam Placeholder', deadlineTitle: '2026-02-20', done: true },
      ]),
    );

    const result = await extractActivities();
    expect(result).toEqual([
      { id: expect.stringMatching(/^act_/), type: 'call', summary: 'Follow up on quote', dueDate: '2026-02-14', assignedTo: 'Sam Placeholder', status: 'open' },
      { id: expect.stringMatching(/^act_/), type: 'email', summary: 'Send brochure', dueDate: '2026-02-20', assignedTo: 'Sam Placeholder', status: 'done' },
    ]);
  });

  it('takes real ids from the RPC cache by row position', async () => {
    populateActivityIdCache([{ id: 501 }, { id: 502 }]);
    render(activityListRows([{ summary: 'First' }, { summary: 'Second' }, { summary: 'Third' }]));

    const ids = (await extractActivities()).map((a) => a.id);
    expect(ids.slice(0, 2)).toEqual(['act_501', 'act_502']);
    expect(ids[2]).toBe(generateContentHash('act', 'Third', 'todo', '', ''));
  });

  describe('relative due dates', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 0, 10, 9, 0, 0));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('resolves untitled relative text against today', async () => {
      render(activityListRows([{ summary: 'Call back', deadlineText: 'In 5 days' }]));
      expect((await extractActivities())[0].dueDate).toBe('2026-01-15');
    });
  });

  it('skips rows without a summary', async () => {
    render(activityListRows([{ summary: '' }, { summary: 'Kept' }]));
    expect((await extractActivities()).map((a) => a.summary)).toEqual(['Kept']);
  });
});

describe('extractActivities from the kanban view', () => {
  it('reads the summary span, type badge, user avatar title and due date', async () => {
    render(
      activityKanbanCards([
        { linkedRecord: 'Widget bulk order', summary: 'Demo call', type: 'Meeting', userTitle: 'Sam Placeholder', deadlineTitle: '01/03/2026' },
      ]),
    );

    const [activity] = await extractActivities();
    expect(activity).toMatchObject({
      type: 'meeting',
      summary: 'Demo call',
      assignedTo: 'Sam Placeholder',
      dueDate: '2026-03-01',
      status: 'open',
    });
  });

  it('falls back to the linked record name and user text', async () => {
    render(activityKanbanCards([{ linkedRecord: 'Widget bulk order', userText: 'Pat Example', type: 'To-Do', done: true }]));

    expect((await extractActivities())[0]).toMatchObject({
      summary: 'Widget bulk order',
      assignedTo: 'Pat Example',
      type: 'todo',
      status: 'done',
    });
  });

  it('returns nothing on a page with neither view', async () => {
    render('<div class="o_form_view"></div>');
    expect(await extractActivities()).toEqual([]);
  });
});
