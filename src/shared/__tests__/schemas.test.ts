import { describe, expect, it } from 'vitest';
import { parseBackgroundMessage, parseContentMessage } from '../schemas';
import { makeActivity, makeContact, makeOpportunity } from '../../test/fixtures';

describe('parseBackgroundMessage', () => {
  it('accepts every well-formed action', () => {
    const messages = [
      { action: 'EXTRACT_DATA' },
      { action: 'EXTRACTION_COMPLETE', data: { contacts: [makeContact()], opportunities: [], activities: [] } },
      { action: 'EXTRACTION_ERROR', error: 'boom' },
      { action: 'GET_DATA' },
      { action: 'SAVE_DATA', data: { contacts: [makeContact()] } },
      { action: 'DELETE_RECORD', data: { type: 'contacts', id: 'contact_1' } },
      { action: 'DELETE_ALL_RECORDS', data: { type: 'activities' } },
      { action: 'UPDATE_BADGE', data: { text: 'ON' } },
      { action: 'ODOO_RPC_UPSERT', data: { type: 'opportunities', records: [makeOpportunity()] } },
      { action: 'ODOO_RPC_DELETE', data: { type: 'activities', ids: ['act_1'] } },
      { action: 'TEST' },
    ];

    for (const message of messages) {
      expect(parseBackgroundMessage(message), message.action).toMatchObject({ ok: true });
    }
  });

  it('reports unknown actions separately from malformed ones', () => {
    expect(parseBackgroundMessage({ action: 'STORAGE_UPDATED' })).toEqual({
      ok: false,
      reason: 'unknown-action',
      action: 'STORAGE_UPDATED',
    });
    expect(parseBackgroundMessage(null)).toMatchObject({ ok: false, reason: 'unknown-action' });
    expect(parseBackgroundMessage('GET_DATA')).toMatchObject({ ok: false, reason: 'unknown-action' });
  });

  it('rejects a delete with no id and names the field', () => {
    const result = parseBackgroundMessage({ action: 'DELETE_RECORD', data: { type: 'contacts' } });
    expect(result).toMatchObject({ ok: false, reason: 'invalid', action: 'DELETE_RECORD' });
    expect(result.ok === false && result.reason === 'invalid' && result.issues.join()).toMatch(/data\.id/);
  });

  it('rejects an unknown record type', () => {
    expect(parseBackgroundMessage({ action: 'DELETE_ALL_RECORDS', data: { type: 'invoices' } })).toMatchObject({
      ok: false,
      reason: 'invalid',
    });
  });

  it('checks upserted records against the schema for their type', () => {
    const wrongShape = { action: 'ODOO_RPC_UPSERT', data: { type: 'contacts', records: [makeOpportunity()] } };
    expect(parseBackgroundMessage(wrongShape)).toMatchObject({ ok: false, reason: 'invalid' });

    const badActivity = { action: 'ODOO_RPC_UPSERT', data: { type: 'activities', records: [{ ...makeActivity(), type: 'fax' }] } };
    expect(parseBackgroundMessage(badActivity)).toMatchObject({ ok: false, reason: 'invalid' });
  });

  it('rejects a revenue sent as text', () => {
    const message = {
      action: 'EXTRACTION_COMPLETE',
      data: { contacts: [], opportunities: [{ ...makeOpportunity(), revenue: '12,500' }], activities: [] },
    };
    expect(parseBackgroundMessage(message)).toMatchObject({ ok: false, reason: 'invalid' });
  });

  it('strips fields the schema does not know', () => {
    const result = parseBackgroundMessage({ action: 'GET_DATA', extra: 'ignored' });
    expect(result).toEqual({ ok: true, message: { action: 'GET_DATA' } });
  });
});

describe('parseContentMessage', () => {
  it('accepts toggles with a boolean', () => {
    expect(parseContentMessage({ action: 'TOGGLE_RPC_SYNC', enabled: false })).toEqual({
      ok: true,
      message: { action: 'TOGGLE_RPC_SYNC', enabled: false },
    });
  });

  it('rejects a toggle without enabled', () => {
    expect(parseContentMessage({ action: 'TOGGLE_AUTO_EXTRACT' })).toMatchObject({ ok: false, reason: 'invalid' });
  });

  it('treats service worker actions as not addressed to it', () => {
    expect(parseContentMessage({ action: 'GET_DATA' })).toMatchObject({ ok: false, reason: 'unknown-action' });
  });
});
