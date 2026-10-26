import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extractCurrentModel } from '../extraction';
import { activityListRows, render } from '../../test/odooDom';

// Its own file, so no earlier test has left RPC activity records in idCache's module state.

vi.mock('../../injected/indicator', () => ({
  setIndicatorState: vi.fn(),
  mountIndicator: vi.fn(),
}));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('activity extraction without captured RPC records', () => {
  it('keeps the activities read from the page', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    render(
      activityListRows([
        { summary: 'Call back', type: 'Call', user: 'Sam Placeholder', deadlineTitle: '20/01/2026' },
        { summary: 'Send quote', type: 'Email' },
      ]),
    );

    const pending = extractCurrentModel('mail.activity', { maxPages: 1, delayBetweenPages: 0 });
    await vi.advanceTimersByTimeAsync(5_000);
    const { activities } = await pending;

    expect(activities.map(({ summary, type, dueDate }) => ({ summary, type, dueDate }))).toEqual([
      { summary: 'Call back', type: 'call', dueDate: '2026-01-20' },
      { summary: 'Send quote', type: 'email', dueDate: '' },
    ]);
  });
});
