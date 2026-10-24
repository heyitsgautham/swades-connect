import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setIndicatorState } from '../../injected/indicator';
import { handleExtraction, isExtractionRunning } from '../extraction';
import { populateActivityIdCache } from '../idCache';
import { contactListRows, activityListRows, render } from '../../test/odooDom';
import { chromeMock } from '../../test/chromeMock';

vi.mock('../../injected/indicator', () => ({
  setIndicatorState: vi.fn(),
  mountIndicator: vi.fn(),
}));

/** Render an Odoo web client for one model, with a visible client area so the render wait ends. */
function renderOdooPage(resModel: string, content: string) {
  render(`<div class="o_web_client">
    <table><thead><tr><th data-tooltip-info='{"resModel":"${resModel}"}'>Name</th></tr></thead></table>
    ${content}
  </div>`);
  Object.defineProperty(document.querySelector('.o_web_client'), 'offsetHeight', { value: 600 });
}

async function runExtraction() {
  const pending = handleExtraction();
  await vi.advanceTimersByTimeAsync(5_000);
  return pending;
}

const completeMessage = () =>
  chromeMock()
    .runtime.sendMessage.mock.calls.map(([message]) => message as { action: string; data?: Record<string, unknown> })
    .find((message) => message.action === 'EXTRACTION_COMPLETE');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-20T10:00:00Z'));
  vi.mocked(setIndicatorState).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('handleExtraction', () => {
  it('extracts the contacts page and reports them with elapsed time, not a timestamp', async () => {
    renderOdooPage(
      'res.partner',
      contactListRows([{ partnerId: 12, completeName: 'Mira Testwell', email: 'mira@example.com' }]),
    );

    const response = await runExtraction();

    expect(response).toEqual({ success: true, data: { recordsExtracted: 1 } });
    const message = completeMessage();
    expect(message?.data?.contacts).toEqual([
      { id: 'contact_12', name: 'Mira Testwell', email: 'mira@example.com', phone: '', company: '', country: '' },
    ]);
    const metadata = message?.data?.metadata as {
      extractionTimeMs: number;
      dataModel: string;
      recordsExtracted: number;
    };
    expect(metadata.dataModel).toBe('res.partner');
    expect(metadata.recordsExtracted).toBe(1);
    expect(metadata.extractionTimeMs).toBeGreaterThanOrEqual(500);
    expect(metadata.extractionTimeMs).toBeLessThan(60_000);
    expect(setIndicatorState).toHaveBeenLastCalledWith('success', 'Done');
    expect(isExtractionRunning()).toBe(false);
  });

  it('builds activities from the RPC records captured while paging', async () => {
    populateActivityIdCache([
      {
        id: 61,
        summary: 'From RPC',
        activity_type_id: [1, 'Call'],
        user_id: [2, 'Sam Placeholder'],
        date_deadline: '2026-02-01',
      },
    ]);
    renderOdooPage('mail.activity', activityListRows([{ summary: 'From DOM' }]));

    await runExtraction();

    const activities = completeMessage()?.data?.activities as { id: string; summary: string }[];
    expect(activities).toContainEqual(expect.objectContaining({ id: 'act_61', summary: 'From RPC', type: 'call' }));
    expect(activities.some((a) => a.summary === 'From DOM')).toBe(false);
  });

  it('refuses to start while another extraction is running', async () => {
    renderOdooPage('res.partner', contactListRows([{ partnerId: 1, completeName: 'A' }]));

    const first = handleExtraction();
    const second = await handleExtraction();
    await vi.advanceTimersByTimeAsync(5_000);
    await first;

    expect(second).toEqual({ success: false, error: 'Extraction already in progress' });
  });

  it('still answers success when the service worker cannot be reached, and shows the error', async () => {
    renderOdooPage('res.partner', contactListRows([{ partnerId: 1, completeName: 'A' }]));
    chromeMock().runtime.sendMessage.mockRejectedValueOnce(new Error('Receiving end does not exist'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await runExtraction();

    expect(response.success).toBe(true);
    expect(setIndicatorState).toHaveBeenLastCalledWith('error', 'Error');
  });
});
