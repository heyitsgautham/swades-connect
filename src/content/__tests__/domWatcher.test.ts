import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DOMWatcher, isDOMWatcherActive, startDOMWatcher, stopDOMWatcher } from '../domWatcher';
import { render } from '../../test/odooDom';

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  render('<div class="o_pager"><span class="o_pager_value">1-2</span></div><table><tbody></tbody></table>');
});

afterEach(() => {
  stopDOMWatcher();
  vi.useRealTimers();
});

/** MutationObserver callbacks run as microtasks; let them fire, then pass the debounce. */
async function settle(ms: number) {
  await Promise.resolve();
  await vi.advanceTimersByTimeAsync(ms);
}

describe('DOMWatcher', () => {
  it('fires once, debounced, when data rows are added', async () => {
    const onChange = vi.fn();
    const watcher = new DOMWatcher({ onChange, debounceMs: 200 });
    watcher.start();

    const tbody = document.querySelector('tbody')!;
    tbody.insertAdjacentHTML('beforeend', '<tr class="o_data_row"><td>a</td></tr>');
    tbody.insertAdjacentHTML('beforeend', '<tr class="o_data_row"><td>b</td></tr>');
    await settle(250);

    expect(onChange).toHaveBeenCalledOnce();
    watcher.stop();
  });

  it('ignores pager and other non-row changes', async () => {
    const onChange = vi.fn();
    const watcher = new DOMWatcher({ onChange, debounceMs: 50 });
    watcher.start();

    document.querySelector('.o_pager_value')!.textContent = '3-4';
    document.body.insertAdjacentHTML('beforeend', '<div class="o_notification">Saved</div>');
    await settle(100);

    expect(onChange).not.toHaveBeenCalled();
    watcher.stop();
  });

  it('stops observing after stop()', async () => {
    const onChange = vi.fn();
    const watcher = new DOMWatcher({ onChange, debounceMs: 50 });
    watcher.start();
    expect(watcher.isActive()).toBe(true);
    watcher.stop();
    expect(watcher.isActive()).toBe(false);

    document.querySelector('tbody')!.insertAdjacentHTML('beforeend', '<tr class="o_data_row"></tr>');
    await settle(100);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('global watcher helpers', () => {
  it('replace an existing watcher and report whether one is active', () => {
    expect(isDOMWatcherActive()).toBe(false);
    startDOMWatcher(() => {}, 100);
    startDOMWatcher(() => {}, 100);
    expect(isDOMWatcherActive()).toBe(true);
    stopDOMWatcher();
    expect(isDOMWatcherActive()).toBe(false);
  });
});
