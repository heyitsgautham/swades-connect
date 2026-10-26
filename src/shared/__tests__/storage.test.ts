import { describe, it, expect, vi } from 'vitest';
import {
  clearAll,
  deduplicateById,
  deleteAllRecords,
  deleteRecord,
  deleteRecordsById,
  getData,
  initializeStorage,
  mergeNonEmpty,
  saveData,
  upsertRecords,
  upsertUpgradingHashIds,
} from '../storage';
import { acquireLock, releaseLock } from '../lock';
import { StorageError } from '../errors';
import type { StorageSchema } from '../types';
import { chromeMock } from '../../test/chromeMock';
import { makeActivity, makeContact, makeOpportunity } from '../../test/fixtures';

describe('Storage utilities', () => {
  describe('deduplicateById', () => {
    it('should deduplicate records by ID, keeping last one', () => {
      const records = [
        { id: '1', name: 'Alice', value: 10 },
        { id: '2', name: 'Bob', value: 20 },
        { id: '1', name: 'Alice Updated', value: 15 }, // Duplicate ID
      ];

      const deduplicated = deduplicateById(records);

      expect(deduplicated).toHaveLength(2);
      expect(deduplicated.find((r) => r.id === '1')?.value).toBe(15);
      expect(deduplicated.find((r) => r.id === '2')?.value).toBe(20);
    });

    it('should handle empty arrays', () => {
      const result = deduplicateById([]);
      expect(result).toEqual([]);
    });

    it('should handle single record', () => {
      const records = [{ id: '1', name: 'Only One' }];
      const result = deduplicateById(records);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Only One');
    });

    it('should preserve order based on last occurrence', () => {
      const records = [
        { id: '3', name: 'Third' },
        { id: '1', name: 'First' },
        { id: '2', name: 'Second' },
        { id: '1', name: 'First Updated' },
      ];

      const deduplicated = deduplicateById(records);

      expect(deduplicated).toHaveLength(3);
      // Map preserves insertion order, but last value wins
      const ids = deduplicated.map((r) => r.id);
      expect(ids).toContain('1');
      expect(ids).toContain('2');
      expect(ids).toContain('3');
    });

    it('should handle multiple duplicates of same ID', () => {
      const records = [
        { id: '1', version: 1 },
        { id: '1', version: 2 },
        { id: '1', version: 3 },
        { id: '1', version: 4 },
      ];

      const deduplicated = deduplicateById(records);

      expect(deduplicated).toHaveLength(1);
      expect(deduplicated[0].version).toBe(4);
    });
  });
});

describe('storage against chrome.storage.local', () => {
  const stored = () => chromeMock().storage.local.dump().odoo_data as StorageSchema['odoo_data'];

  it('getData returns empty collections before anything is saved', async () => {
    expect(await getData()).toEqual({ contacts: [], opportunities: [], activities: [], lastSync: 0 });
  });

  it('getData drops stored records that do not match their schema and fills in missing collections', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const contact = makeContact();
    await chromeMock().storage.local.set({
      odoo_data: { contacts: [contact, { id: 5, name: 'no email' }], activities: 'not a list', lastSync: 'yesterday' },
    });

    expect(await getData()).toEqual({ contacts: [contact], opportunities: [], activities: [], lastSync: 0 });
    expect(warn).toHaveBeenCalledWith('[Swades Connect:storage] Dropped stored records that do not match the schema', {
      type: 'contacts',
      dropped: 1,
    });
  });

  it('saveData still works when the stored data is missing a collection', async () => {
    await chromeMock().storage.local.set({ odoo_data: { contacts: [makeContact({ id: 'old' })], lastSync: 1 } });

    await saveData([], [makeOpportunity()], []);

    expect(stored().contacts.map((c) => c.id)).toEqual(['old']);
    expect(stored().opportunities).toHaveLength(1);
    expect(stored().activities).toEqual([]);
  });

  it('getData hands out a fresh empty object each time', async () => {
    const first = await getData();
    first.contacts.push(makeContact());
    expect((await getData()).contacts).toEqual([]);
  });

  it('initializeStorage writes the default shape once and keeps existing data', async () => {
    await initializeStorage();
    expect(stored().contacts).toEqual([]);

    await saveData([makeContact()], [], []);
    await initializeStorage();
    expect(stored().contacts).toHaveLength(1);
  });

  it('saveData merges with existing records and lets the newer copy win', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-20T10:00:00Z'));
    await saveData([makeContact({ id: 'contact_1', phone: 'old' })], [makeOpportunity()], []);
    await saveData(
      [makeContact({ id: 'contact_1', phone: 'new' }), makeContact({ id: 'contact_2' })],
      [],
      [makeActivity()],
    );

    const data = stored();
    expect(data.contacts.map((c) => [c.id, c.phone])).toEqual([
      ['contact_1', 'new'],
      ['contact_2', '+1 555 0101'],
    ]);
    expect(data.opportunities).toHaveLength(1);
    expect(data.activities).toHaveLength(1);
    expect(data.lastSync).toBe(Date.parse('2026-01-20T10:00:00Z'));
  });

  it('deleteRecord removes one record from the named collection only', async () => {
    await saveData([makeContact({ id: 'x' })], [makeOpportunity({ id: 'x' })], []);
    await deleteRecord('contacts', 'x');
    expect(stored().contacts).toEqual([]);
    expect(stored().opportunities).toHaveLength(1);
  });

  it('deleteAllRecords empties one collection', async () => {
    await saveData([makeContact()], [makeOpportunity()], [makeActivity()]);
    await deleteAllRecords('activities');
    expect(stored().activities).toEqual([]);
    expect(stored().contacts).toHaveLength(1);
  });

  it('clearAll wipes other keys and restores the default shape', async () => {
    await chromeMock().storage.local.set({ rpc_sync_enabled: true });
    await saveData([makeContact()], [], []);
    await clearAll();
    expect(chromeMock().storage.local.dump()).toEqual({
      odoo_data: { contacts: [], opportunities: [], activities: [], lastSync: 0 },
    });
  });

  describe('upsertRecords', () => {
    it('returns zero counts without touching storage for an empty batch', async () => {
      expect(await upsertRecords('contacts', [])).toEqual({ added: 0, updated: 0 });
      expect(chromeMock().storage.local.set).not.toHaveBeenCalled();
    });

    it('adds new records and merges updates, ignoring empty incoming fields', async () => {
      await saveData([makeContact({ id: 'contact_1', email: 'keep@example.com', phone: '111' })], [], []);

      const result = await upsertRecords('contacts', [
        makeContact({ id: 'contact_1', email: '', phone: '222' }),
        makeContact({ id: 'contact_2' }),
      ]);

      expect(result).toEqual({ added: 1, updated: 1 });
      const first = stored().contacts.find((c) => c.id === 'contact_1');
      expect(first).toMatchObject({ email: 'keep@example.com', phone: '222' });
      expect(stored().contacts).toHaveLength(2);
    });

    it('releases its lock so the next write can proceed', async () => {
      await upsertRecords('contacts', [makeContact()]);
      expect(chromeMock().storage.session.dump().extraction_lock).toBeUndefined();
    });

    it('throws when another writer holds the lock past the wait limit', async () => {
      vi.useFakeTimers();
      await acquireLock('someone-else');
      const pending = upsertRecords('contacts', [makeContact()]);
      const assertion = expect(pending).rejects.toSatisfy(
        (error) =>
          error instanceof StorageError &&
          /Failed to acquire lock/.test(error.message) &&
          error.context.type === 'contacts',
      );
      await vi.advanceTimersByTimeAsync(5_100);
      await assertion;
    });
  });

  describe('deleteRecordsById', () => {
    it('removes matching ids and reports how many were found', async () => {
      await saveData([], [makeOpportunity({ id: 'opp_1' }), makeOpportunity({ id: 'opp_2' })], []);
      expect(await deleteRecordsById('opportunities', ['opp_1', 'opp_missing'])).toBe(1);
      expect(stored().opportunities.map((o) => o.id)).toEqual(['opp_2']);
    });

    it('returns 0 for an empty id list', async () => {
      expect(await deleteRecordsById('opportunities', [])).toBe(0);
    });
  });
});

describe('mergeNonEmpty', () => {
  it('lets incoming values win except empty ones', () => {
    expect(
      mergeNonEmpty(makeContact({ email: 'keep@example.com', phone: '1' }), makeContact({ email: '', phone: '2' })),
    ).toMatchObject({
      email: 'keep@example.com',
      phone: '2',
    });
  });

  it('keeps an incoming zero', () => {
    expect(mergeNonEmpty(makeOpportunity({ revenue: 500 }), makeOpportunity({ revenue: 0 })).revenue).toBe(0);
  });
});

describe('upsertUpgradingHashIds', () => {
  const stored = () => chromeMock().storage.local.dump().odoo_data as StorageSchema['odoo_data'];

  it('upgrades a hash-id opportunity to the real id when the name matches', async () => {
    await saveData([], [makeOpportunity({ id: 'opp_lnl5ct', name: 'Widget Bulk Order', revenue: 100 })], []);

    const result = await upsertUpgradingHashIds('opportunities', [
      makeOpportunity({ id: 'opp_24', name: '  widget bulk order ', revenue: 900, closeDate: '' }),
    ]);

    expect(result).toEqual({ added: 0, updated: 1 });
    expect(stored().opportunities).toEqual([
      expect.objectContaining({ id: 'opp_24', revenue: 900, closeDate: '2026-03-31' }),
    ]);
  });

  it('upgrades a hash-id activity by summary', async () => {
    await saveData([], [], [makeActivity({ id: 'act_k2j9', summary: 'Follow up on quote' })]);
    await upsertUpgradingHashIds('activities', [
      makeActivity({ id: 'act_10', summary: 'Follow up on quote', status: 'done' }),
    ]);
    expect(stored().activities).toEqual([expect.objectContaining({ id: 'act_10', status: 'done' })]);
  });

  it('matches by id first', async () => {
    await saveData(
      [],
      [makeOpportunity({ id: 'opp_24', name: 'Old name' }), makeOpportunity({ id: 'opp_hash', name: 'New name' })],
      [],
    );
    await upsertUpgradingHashIds('opportunities', [makeOpportunity({ id: 'opp_24', name: 'New name' })]);
    expect(stored().opportunities.map((o) => [o.id, o.name])).toEqual([
      ['opp_24', 'New name'],
      ['opp_hash', 'New name'],
    ]);
  });

  it('does not name-match an incoming hash id', async () => {
    await saveData([], [makeOpportunity({ id: 'opp_aaa', name: 'Same' })], []);
    const result = await upsertUpgradingHashIds('opportunities', [makeOpportunity({ id: 'opp_bbb', name: 'Same' })]);
    expect(result).toEqual({ added: 1, updated: 0 });
    expect(stored().opportunities).toHaveLength(2);
  });

  it('adds records with no match', async () => {
    const result = await upsertUpgradingHashIds('activities', [
      makeActivity({ id: 'act_1' }),
      makeActivity({ id: 'act_2', summary: 'Other' }),
    ]);
    expect(result).toEqual({ added: 2, updated: 0 });
  });

  it('waits for the lock instead of failing at once', async () => {
    vi.useFakeTimers();
    await acquireLock('holder');
    const pending = upsertUpgradingHashIds('activities', [makeActivity()]);
    await vi.advanceTimersByTimeAsync(300);
    await releaseLock('holder');
    await vi.advanceTimersByTimeAsync(200);
    expect(await pending).toEqual({ added: 1, updated: 0 });
  });
});
