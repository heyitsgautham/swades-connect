import { beforeEach, describe, expect, it, vi } from 'vitest';
import { routeMessage } from '../router';
import { saveData } from '../../shared/storage';
import { acquireLock } from '../../shared/lock';
import type { StorageSchema } from '../../shared/types';
import { chromeMock } from '../../test/chromeMock';
import { makeActivity, makeContact, makeOpportunity } from '../../test/fixtures';

const popup = {} as chrome.runtime.MessageSender;
const fromTab = (id: number) => ({ tab: { id } as chrome.tabs.Tab, url: 'https://demo.odoo.com/odoo/contacts' });
const stored = () => chromeMock().storage.local.dump().odoo_data as StorageSchema['odoo_data'];

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('routeMessage validation', () => {
  it('answers Unknown action for actions it does not handle', async () => {
    expect(await routeMessage({ action: 'NOPE' }, popup)).toEqual({ success: false, error: 'Unknown action' });
  });

  it('rejects malformed messages before any handler runs', async () => {
    const response = await routeMessage({ action: 'DELETE_RECORD', data: { type: 'contacts' } }, popup);
    expect(response.success).toBe(false);
    expect(response.error).toMatch(/^Invalid DELETE_RECORD message: data\.id/);
    expect(chromeMock().storage.local.set).not.toHaveBeenCalled();
  });

  it('answers TEST', async () => {
    expect(await routeMessage({ action: 'TEST' }, popup)).toEqual({
      success: true,
      data: { message: 'Service worker is alive' },
    });
  });
});

describe('data handlers', () => {
  it('GET_DATA returns stored data', async () => {
    await saveData([makeContact()], [], []);
    const response = await routeMessage({ action: 'GET_DATA' }, popup);
    expect(response.success).toBe(true);
    expect((response.data as StorageSchema['odoo_data']).contacts).toHaveLength(1);
  });

  it('SAVE_DATA merges records and broadcasts the update', async () => {
    const response = await routeMessage({ action: 'SAVE_DATA', data: { activities: [makeActivity()] } }, popup);
    expect(response).toEqual({ success: true });
    expect(stored().activities).toHaveLength(1);
    await vi.waitFor(() =>
      expect(chromeMock().runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'STORAGE_UPDATED' }),
        expect.any(Function),
      ),
    );
  });

  it('SAVE_DATA fails cleanly while another write holds the lock', async () => {
    await acquireLock('extraction-in-flight');
    expect(await routeMessage({ action: 'SAVE_DATA', data: {} }, popup)).toEqual({
      success: false,
      error: 'Could not acquire lock',
    });
  });

  it('DELETE_RECORD and DELETE_ALL_RECORDS remove records', async () => {
    await saveData([makeContact({ id: 'a' }), makeContact({ id: 'b' })], [makeOpportunity()], []);

    await routeMessage({ action: 'DELETE_RECORD', data: { type: 'contacts', id: 'a' } }, popup);
    expect(stored().contacts.map((c) => c.id)).toEqual(['b']);

    await routeMessage({ action: 'DELETE_ALL_RECORDS', data: { type: 'opportunities' } }, popup);
    expect(stored().opportunities).toEqual([]);
  });

  it('UPDATE_BADGE sets text, and colour only when there is text', async () => {
    const chrome = chromeMock();
    await routeMessage({ action: 'UPDATE_BADGE', data: { text: 'RPC' } }, popup);
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: 'RPC' });
    expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledOnce();

    await routeMessage({ action: 'UPDATE_BADGE', data: { text: '' } }, popup);
    expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledOnce();
  });
});

describe('extraction handlers', () => {
  it('EXTRACT_DATA from the popup forwards to the active tab', async () => {
    const chrome = chromeMock();
    chrome.tabs.query.mockResolvedValueOnce([{ id: 7 } as chrome.tabs.Tab]);
    chrome.tabs.sendMessage.mockResolvedValueOnce({ success: true, data: { recordsExtracted: 3 } });

    const response = await routeMessage({ action: 'EXTRACT_DATA' }, popup);

    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(7, { action: 'EXTRACT_DATA' });
    expect(response).toEqual({ success: true, data: { recordsExtracted: 3 } });
  });

  it('EXTRACT_DATA from a tab targets that tab', async () => {
    const chrome = chromeMock();
    await routeMessage({ action: 'EXTRACT_DATA' }, fromTab(3));
    expect(chrome.tabs.query).not.toHaveBeenCalled();
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(3, { action: 'EXTRACT_DATA' });
  });

  it('EXTRACT_DATA explains a missing content script', async () => {
    const chrome = chromeMock();
    chrome.tabs.query.mockResolvedValueOnce([{ id: 7 } as chrome.tabs.Tab]);
    chrome.tabs.sendMessage.mockRejectedValueOnce(
      new Error('Could not establish connection. Receiving end does not exist.'),
    );

    const response = await routeMessage({ action: 'EXTRACT_DATA' }, popup);
    expect(response.error).toMatch(/Content script not loaded/);
  });

  it('EXTRACT_DATA without an active tab says so', async () => {
    expect(await routeMessage({ action: 'EXTRACT_DATA' }, popup)).toEqual({
      success: false,
      error: 'No active tab found. Please open an Odoo page first.',
    });
  });

  it('EXTRACTION_COMPLETE stores the extracted records', async () => {
    const response = await routeMessage(
      {
        action: 'EXTRACTION_COMPLETE',
        data: {
          contacts: [makeContact()],
          opportunities: [makeOpportunity()],
          activities: [],
          metadata: {
            viewType: 'list',
            dataModel: 'res.partner',
            recordsExtracted: 2,
            extractionTimeMs: 812,
            timestamp: '2026-01-20T10:00:00Z',
          },
        },
      },
      fromTab(3),
    );

    expect(response).toEqual({ success: true });
    expect(stored().contacts).toHaveLength(1);
    expect(stored().opportunities).toHaveLength(1);
    expect(chromeMock().storage.session.dump().extraction_lock).toBeUndefined();
  });

  it('EXTRACTION_ERROR is acknowledged', async () => {
    expect(await routeMessage({ action: 'EXTRACTION_ERROR', error: 'boom' }, fromTab(3))).toEqual({
      success: true,
      data: { acknowledgement: 'Error logged' },
    });
  });
});

describe('RPC handlers', () => {
  it('ODOO_RPC_UPSERT upserts contacts by id', async () => {
    const response = await routeMessage(
      { action: 'ODOO_RPC_UPSERT', data: { type: 'contacts', records: [makeContact({ id: 'contact_9' })] } },
      fromTab(3),
    );
    expect(response).toEqual({ success: true, data: { added: 1, updated: 0 } });
  });

  it('ODOO_RPC_UPSERT upgrades a hash-id opportunity to the real id', async () => {
    await saveData([], [makeOpportunity({ id: 'opp_hash1', name: 'Widget bulk order' })], []);

    const response = await routeMessage(
      {
        action: 'ODOO_RPC_UPSERT',
        data: { type: 'opportunities', records: [makeOpportunity({ id: 'opp_24', name: 'Widget bulk order' })] },
      },
      fromTab(3),
    );

    expect(response).toEqual({ success: true, data: { added: 0, updated: 1 } });
    expect(stored().opportunities.map((o) => o.id)).toEqual(['opp_24']);
  });

  it('ODOO_RPC_DELETE reports how many records it removed', async () => {
    await saveData([], [], [makeActivity({ id: 'act_1' }), makeActivity({ id: 'act_2' })]);
    const response = await routeMessage(
      { action: 'ODOO_RPC_DELETE', data: { type: 'activities', ids: ['act_1', 'act_404'] } },
      fromTab(3),
    );
    expect(response).toEqual({ success: true, data: { deleted: 1 } });
    expect(stored().activities.map((a) => a.id)).toEqual(['act_2']);
  });
});
