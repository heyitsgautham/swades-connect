import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extractWithPagination, getCurrentPageInfo, hasNextPage } from '../pagination';
import { render } from '../../test/odooDom';

/**
 * A fake Odoo pager over `total` numbered rows, `pageSize` per page.
 * Next and previous buttons re-render the rows and the "start-end / total" counter.
 * Like Odoo, Next on the last page wraps around to the first.
 */
function mountPager(total: number, pageSize: number, startPage = 0) {
  let page = startPage;
  const pages = Math.ceil(total / pageSize);

  const draw = () => {
    const start = page * pageSize + 1;
    const end = Math.min(total, start + pageSize - 1);
    document.querySelector('.o_pager_value')!.textContent = `${start}-${end}`;
    document.querySelector('tbody')!.innerHTML = Array.from(
      { length: end - start + 1 },
      (_, i) => `<tr class="o_data_row"><td>row ${start + i}</td></tr>`,
    ).join('');
  };

  render(`
    <div class="o_pager">
      <span class="o_pager_value"></span> / <span class="o_pager_limit">${total}</span>
      <button class="o_pager_previous"></button><button class="o_pager_next"></button>
    </div>
    <table><tbody></tbody></table>`);
  document.querySelector('.o_pager_next')!.addEventListener('click', () => {
    page = (page + 1) % pages;
    draw();
  });
  document.querySelector('.o_pager_previous')!.addEventListener('click', () => {
    page = (page - 1 + pages) % pages;
    draw();
  });
  draw();
}

const rowsOnPage = () => Array.from(document.querySelectorAll('tr.o_data_row'), (row) => row.textContent ?? '');

async function run(config: Parameters<typeof extractWithPagination>[1]) {
  const pending = extractWithPagination(rowsOnPage, {
    delayBetweenPages: 10,
    waitForRpcCache: false,
    forceStableSort: false,
    ...config,
  });
  await vi.advanceTimersByTimeAsync(10_000);
  return pending;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
});

describe('getCurrentPageInfo', () => {
  it('reads the Odoo 19 pager value and limit', () => {
    mountPager(302, 80);
    expect(getCurrentPageInfo()).toEqual({ currentRange: '1-80', total: 302, currentStart: 1, currentEnd: 80 });
  });

  it('reads the older single counter', () => {
    render('<span class="o_pager_counter">81-160 / 302</span>');
    expect(getCurrentPageInfo()).toEqual({ currentRange: '81-160', total: 302, currentStart: 81, currentEnd: 160 });
  });

  it('returns null without a pager', () => {
    render('<div></div>');
    expect(getCurrentPageInfo()).toBeNull();
  });
});

describe('hasNextPage', () => {
  it('is false for a disabled next button', () => {
    render('<button class="o_pager_next" disabled></button>');
    expect(hasNextPage()).toBe(false);
    render('<button class="o_pager_next"></button>');
    expect(hasNextPage()).toBe(true);
  });
});

describe('extractWithPagination', () => {
  it('collects every page and stops at the reported total', async () => {
    mountPager(5, 2);
    expect(await run({})).toEqual(['row 1', 'row 2', 'row 3', 'row 4', 'row 5']);
  });

  it('starts from the first page when the user is further in', async () => {
    mountPager(5, 2, 2);
    expect(await run({})).toEqual(['row 1', 'row 2', 'row 3', 'row 4', 'row 5']);
  });

  it('stops after maxPages', async () => {
    mountPager(10, 2);
    expect(await run({ maxPages: 2 })).toEqual(['row 1', 'row 2', 'row 3', 'row 4']);
  });

  it('extracts a single page when there is no pager', async () => {
    render('<table><tbody><tr class="o_data_row"><td>only</td></tr></tbody></table>');
    expect(await run({})).toEqual(['only']);
  });

  it('clicks a sortable column once to force a stable order', async () => {
    mountPager(2, 2);
    document.body.insertAdjacentHTML(
      'afterbegin',
      '<table><thead><tr><th class="o_column_sortable">Summary</th></tr></thead></table>',
    );
    const header = document.querySelector('th.o_column_sortable') as HTMLElement;
    const click = vi.fn();
    header.addEventListener('click', click);

    await run({ forceStableSort: true });
    expect(click).toHaveBeenCalledOnce();
  });
});
