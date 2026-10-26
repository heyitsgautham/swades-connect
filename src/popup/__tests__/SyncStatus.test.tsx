import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SyncStatus from '../components/SyncStatus';

const NOW = new Date('2026-10-26T12:00:00Z').getTime();
const MINUTE = 60_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SyncStatus', () => {
  it.each([
    [undefined, 'Never synced'],
    [NOW - 30_000, 'Just now'],
    [NOW - 5 * MINUTE, '5 min ago'],
    [NOW - 3 * 60 * MINUTE, '3h ago'],
    [NOW - 2 * 24 * 60 * MINUTE, '2d ago'],
  ])('shows %s as "%s"', (lastSync, text) => {
    render(<SyncStatus lastSync={lastSync} />);
    expect(screen.getByText(`Last sync: ${text}`)).toBeTruthy();
  });

  it('moves the relative time forward every minute while open', () => {
    render(<SyncStatus lastSync={NOW - 30_000} />);
    expect(screen.getByText('Last sync: Just now')).toBeTruthy();

    act(() => vi.advanceTimersByTime(2 * MINUTE));

    expect(screen.getByText('Last sync: 2 min ago')).toBeTruthy();
  });
});
