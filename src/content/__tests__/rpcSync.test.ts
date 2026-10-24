import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OdooRpcMethod, OdooRpcSignal } from '../../injected/rpcInterceptor';
import { setIndicatorState } from '../../injected/indicator';
import { handleRpcSignal, isRpcSyncEnabled, startRpcSync, stopRpcSync } from '../rpcSync';
import {
  clearActivityIdCache,
  clearOpportunityIdCache,
  getActivityIdArray,
  lookupOpportunityId,
} from '../idCache';
import { chromeMock } from '../../test/chromeMock';

vi.mock('../../injected/indicator', () => ({
  setIndicatorState: vi.fn(),
  mountIndicator: vi.fn(),
}));

function signal(model: string, method: OdooRpcMethod, args: unknown[], result: unknown): OdooRpcSignal {
  return {
    source: 'odoo-rpc-interceptor',
    payload: { model, method, args, result, url: '/web/dataset/call_kw', ts: 0 },
  };
}

const sent = () => chromeMock().runtime.sendMessage.mock.calls.map(([message]) => message);
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  clearOpportunityIdCache();
  clearActivityIdCache();
  vi.mocked(setIndicatorState).mockClear();
});

describe('handleRpcSignal', () => {
  it('upserts contacts loaded by web_search_read', () => {
    handleRpcSignal(
      signal('res.partner', 'web_search_read', [], {
        length: 1,
        records: [{ id: 12, name: 'Mira Testwell', email: 'mira@example.com', country_id: [1, 'Testland'] }],
      }),
    );

    expect(sent()).toEqual([
      {
        action: 'ODOO_RPC_UPSERT',
        data: {
          type: 'contacts',
          records: [{ id: 'contact_12', name: 'Mira Testwell', email: 'mira@example.com', phone: '', company: '', country: 'Testland' }],
        },
      },
    ]);
  });

  it('caches opportunity ids from grouped kanban loads', () => {
    handleRpcSignal(
      signal('crm.lead', 'web_read_group', [], {
        groups: [{ __records: [{ id: 30, name: 'Widget bulk order', stage_id: [1, 'New'] }] }],
      }),
    );

    expect(lookupOpportunityId('widget bulk order')).toBe(30);
    expect(sent()[0]).toMatchObject({ action: 'ODOO_RPC_UPSERT', data: { type: 'opportunities' } });
  });

  it('records activity ids in page order for the DOM extractor', () => {
    handleRpcSignal(signal('mail.activity', 'web_search_read', [], { records: [{ id: 5 }, { id: 9 }] }));
    expect(getActivityIdArray()).toEqual([5, 9]);
  });

  it('sends nothing for an empty load', () => {
    handleRpcSignal(signal('res.partner', 'web_search_read', [], { length: 0, records: [] }));
    expect(sent()).toEqual([]);
  });

  it('prefixes deleted ids for unlink and action_done', async () => {
    handleRpcSignal(signal('crm.lead', 'unlink', [[30, 31]], true));
    handleRpcSignal(signal('mail.activity', 'action_done', [[7]], true));
    await flush();

    expect(sent()).toEqual([
      { action: 'ODOO_RPC_DELETE', data: { type: 'opportunities', ids: ['opp_30', 'opp_31'] } },
      { action: 'ODOO_RPC_DELETE', data: { type: 'activities', ids: ['act_7'] } },
    ]);
    expect(setIndicatorState).toHaveBeenCalledWith('success', 'Deleted');
    expect(setIndicatorState).toHaveBeenCalledWith('success', 'Marked Done');
  });

  it('creates a contact from name_create', async () => {
    handleRpcSignal(signal('res.partner', 'name_create', ['Quick Contact'], [55, 'Quick Contact']));
    await flush();

    expect(sent()).toEqual([
      {
        action: 'ODOO_RPC_UPSERT',
        data: { type: 'contacts', records: [{ id: 'contact_55', name: 'Quick Contact', email: '', phone: '', company: '', country: '' }] },
      },
    ]);
    expect(setIndicatorState).toHaveBeenCalledWith('success', 'Contact Created');
  });

  it('ignores name_create on other models', () => {
    handleRpcSignal(signal('crm.lead', 'name_create', ['Deal'], [1, 'Deal']));
    expect(sent()).toEqual([]);
  });

  it('builds an added opportunity from web_save args when the result is id-only', async () => {
    handleRpcSignal(signal('crm.lead', 'web_save', [[], { name: 'New deal', expected_revenue: 900, stage_id: 1 }], [{ id: 44 }]));
    await flush();

    expect(sent()).toEqual([
      {
        action: 'ODOO_RPC_UPSERT',
        data: {
          type: 'opportunities',
          records: [{ id: 'opp_44', name: 'New deal', revenue: 900, stage: 'Stage 1', probability: 0, closeDate: '' }],
        },
      },
    ]);
    expect(lookupOpportunityId('New deal')).toBe(44);
    expect(setIndicatorState).toHaveBeenCalledWith('success', 'Added');
  });

  it('syncs a full record returned by an edit', async () => {
    handleRpcSignal(
      signal('mail.activity', 'web_save', [[8], { summary: 'Edited' }], [
        { id: 8, summary: 'Edited', activity_type_id: [1, 'Email'], user_id: [2, 'Sam Placeholder'], date_deadline: '2026-02-01' },
      ]),
    );
    await flush();

    expect(sent()[0]).toMatchObject({
      data: { type: 'activities', records: [{ id: 'act_8', type: 'email', summary: 'Edited' }] },
    });
    expect(setIndicatorState).toHaveBeenCalledWith('success', 'Synced');
  });

  it('skips the activity schedule wizard, whose id is not the activity id', () => {
    handleRpcSignal(signal('mail.activity.schedule', 'web_save', [[], { summary: 'x' }], [{ id: 18 }]));
    expect(sent()).toEqual([]);
  });

  it('ignores models it does not sync', () => {
    handleRpcSignal(signal('sale.order', 'web_save', [[], {}], [{ id: 1 }]));
    expect(sent()).toEqual([]);
    expect(setIndicatorState).not.toHaveBeenCalled();
  });

  it('shows a sync error when the service worker rejects the upsert', async () => {
    chromeMock().runtime.sendMessage.mockRejectedValueOnce(new Error('no receiver'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    handleRpcSignal(signal('crm.lead', 'web_save', [[1], {}], [{ id: 1, name: 'Deal' }]));
    await flush();
    expect(setIndicatorState).toHaveBeenLastCalledWith('error', 'Sync failed');
  });
});

describe('startRpcSync and stopRpcSync', () => {
  it('persist the setting, set the badge and listen for page messages', () => {
    const addListener = vi.spyOn(window, 'addEventListener');
    const removeListener = vi.spyOn(window, 'removeEventListener');

    startRpcSync();
    expect(isRpcSyncEnabled()).toBe(true);
    expect(chromeMock().storage.local.dump().rpc_sync_enabled).toBe(true);
    expect(sent()).toContainEqual({ action: 'UPDATE_BADGE', data: { text: 'RPC' } });
    expect(addListener).toHaveBeenCalledWith('message', expect.any(Function));

    startRpcSync();
    expect(addListener).toHaveBeenCalledTimes(1);

    stopRpcSync();
    expect(isRpcSyncEnabled()).toBe(false);
    expect(chromeMock().storage.local.dump().rpc_sync_enabled).toBe(false);
    expect(removeListener).toHaveBeenCalledWith('message', addListener.mock.calls[0][1]);
  });
});
