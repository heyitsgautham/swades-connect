import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setIndicatorState } from '../../injected/indicator';
import { isDOMWatcherActive, startDOMWatcher, stopDOMWatcher } from '../domWatcher';
import { startAutoExtract, stopAutoExtract } from '../extraction';
import { detectDataModel } from '../viewDetector';
import { chromeMock } from '../../test/chromeMock';

vi.mock('../../injected/indicator', () => ({ setIndicatorState: vi.fn(), mountIndicator: vi.fn() }));
vi.mock('../domWatcher', () => ({
  isDOMWatcherActive: vi.fn(() => false),
  startDOMWatcher: vi.fn(),
  stopDOMWatcher: vi.fn(),
}));
vi.mock('../viewDetector', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../viewDetector')>()),
  detectDataModel: vi.fn(() => 'unknown'),
}));

const badgeTexts = () =>
  chromeMock()
    .runtime.sendMessage.mock.calls.map(([message]) => message as { action: string; data?: { text: string } })
    .filter((message) => message.action === 'UPDATE_BADGE')
    .map((message) => message.data?.text);

/** The callback startAutoExtract handed to the DOM watcher. */
const onRowsChanged = () => vi.mocked(startDOMWatcher).mock.calls[0][0] as () => Promise<void>;

beforeEach(() => {
  vi.mocked(startDOMWatcher).mockClear();
  vi.mocked(stopDOMWatcher).mockClear();
  vi.mocked(setIndicatorState).mockClear();
  vi.mocked(isDOMWatcherActive).mockReturnValue(false);
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

describe('auto-extract', () => {
  it('starts the DOM watcher with a 5 second debounce, sets the badge to ON and says so', () => {
    startAutoExtract();

    expect(startDOMWatcher).toHaveBeenCalledWith(expect.any(Function), 5000);
    expect(badgeTexts()).toEqual(['ON']);
    expect(setIndicatorState).toHaveBeenLastCalledWith('idle', 'Auto-extract ON');
  });

  it('does not start a second watcher while one is running', () => {
    vi.mocked(isDOMWatcherActive).mockReturnValue(true);

    startAutoExtract();

    expect(startDOMWatcher).not.toHaveBeenCalled();
    expect(badgeTexts()).toEqual([]);
  });

  it('ignores row changes on a page that is not an Odoo data view', async () => {
    startAutoExtract();
    vi.mocked(setIndicatorState).mockClear();

    await onRowsChanged()();

    expect(setIndicatorState).not.toHaveBeenCalled();
    expect(chromeMock().runtime.sendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'EXTRACTION_COMPLETE' }),
    );
  });

  it('re-extracts when rows change on a contacts page', async () => {
    vi.useFakeTimers();
    vi.mocked(detectDataModel).mockReturnValue('res.partner');
    startAutoExtract();

    const run = onRowsChanged()();
    await vi.advanceTimersByTimeAsync(5_000);
    await run;

    expect(setIndicatorState).toHaveBeenCalledWith('extracting', 'Auto-extracting...');
    expect(chromeMock().runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'EXTRACTION_COMPLETE' }),
    );
  });

  it('stops the watcher, clears the badge and returns the indicator to Ready', () => {
    stopAutoExtract();

    expect(stopDOMWatcher).toHaveBeenCalledOnce();
    expect(badgeTexts()).toEqual(['']);
    expect(setIndicatorState).toHaveBeenLastCalledWith('idle', 'Ready');
  });
});
