import { describe, expect, it } from 'vitest';
import {
  deleteAllStoredRecords,
  deleteStoredRecord,
  fetchStoredData,
  parseStorageUpdate,
  requestExtraction,
} from '../background';
import { BackgroundRequestError } from '../../shared/errors';
import { chromeMock } from '../../test/chromeMock';
import { makeContact } from '../../test/fixtures';

const stored = { contacts: [makeContact()], opportunities: [], activities: [], lastSync: 1700000000000 };

function reply(value: unknown) {
  chromeMock().runtime.sendMessage.mockResolvedValue(value);
}

describe('fetchStoredData', () => {
  it('returns the stored data from a GET_DATA reply', async () => {
    reply({ success: true, data: stored });

    await expect(fetchStoredData()).resolves.toEqual(stored);
    expect(chromeMock().runtime.sendMessage).toHaveBeenCalledWith({ action: 'GET_DATA' });
  });

  it('rejects with the reply error when the service worker reports a failure', async () => {
    reply({ success: false, error: 'Storage is unavailable' });

    await expect(fetchStoredData()).rejects.toThrow('Storage is unavailable');
  });

  it('rejects with the fallback message when there is no reply', async () => {
    reply(undefined);

    const error = await fetchStoredData().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BackgroundRequestError);
    expect(error).toMatchObject({ message: 'Failed to fetch data', action: 'GET_DATA' });
  });

  it('rejects when the stored data is in the wrong shape', async () => {
    reply({ success: true, data: { contacts: 'nope' } });

    await expect(fetchStoredData()).rejects.toThrow('Stored data came back in an unexpected shape');
  });

  it('rejects with the delivery error when the service worker cannot be reached', async () => {
    chromeMock().runtime.sendMessage.mockRejectedValue(new Error('Extension context invalidated.'));

    await expect(fetchStoredData()).rejects.toThrow('Extension context invalidated.');
  });
});

describe('deletes', () => {
  it('sends DELETE_RECORD and DELETE_ALL_RECORDS with their payloads', async () => {
    reply({ success: true });

    await deleteStoredRecord('contacts', 'c1');
    await deleteAllStoredRecords('activities');

    expect(chromeMock().runtime.sendMessage.mock.calls.map(([message]) => message)).toEqual([
      { action: 'DELETE_RECORD', data: { type: 'contacts', id: 'c1' } },
      { action: 'DELETE_ALL_RECORDS', data: { type: 'activities' } },
    ]);
  });

  it('falls back to a message naming the operation', async () => {
    reply({ success: false });

    await expect(deleteStoredRecord('contacts', 'c1')).rejects.toThrow('Failed to delete record');
    await expect(deleteAllStoredRecords('contacts')).rejects.toThrow('Failed to delete all records');
  });
});

describe('requestExtraction', () => {
  it('resolves to the number of records stored', async () => {
    reply({ success: true, data: { recordsExtracted: 11 } });
    await expect(requestExtraction()).resolves.toBe(11);
  });

  it('resolves to 0 when the reply carries no count', async () => {
    reply({ success: true });
    await expect(requestExtraction()).resolves.toBe(0);
  });
});

describe('parseStorageUpdate', () => {
  it('returns the data of a well-formed STORAGE_UPDATED broadcast', () => {
    expect(parseStorageUpdate({ action: 'STORAGE_UPDATED', data: stored })).toEqual(stored);
  });

  it.each([
    ['another action', { action: 'GET_DATA' }],
    ['a broadcast with bad records', { action: 'STORAGE_UPDATED', data: { ...stored, contacts: [{ id: '' }] } }],
    ['not an object', 'STORAGE_UPDATED'],
  ])('ignores %s', (_label, message) => {
    expect(parseStorageUpdate(message)).toBeNull();
  });
});
