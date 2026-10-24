import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearActivityIdCache,
  clearOpportunityIdCache,
  getActivityIdArray,
  getActivityIdCacheSize,
  getAllActivityRecords,
  getAllSeenActivityIds,
  getOpportunityIdCacheSize,
  initializeOpportunityIdCacheFromStorage,
  lookupActivityId,
  lookupOpportunityId,
  normalizeOpportunityName,
  populateActivityIdCache,
  populateOpportunityIdCache,
  setActivityId,
  setOpportunityId,
  startActivityExtractionSession,
} from '../idCache';
import { chromeMock } from '../../test/chromeMock';

beforeEach(() => {
  clearOpportunityIdCache();
  clearActivityIdCache();
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

describe('opportunity id cache', () => {
  it('normalizes names for lookup', () => {
    expect(normalizeOpportunityName('  Widget ORDER ')).toBe('widget order');
    populateOpportunityIdCache([{ id: 3, name: 'Widget Order' }]);
    expect(lookupOpportunityId(' widget order')).toBe(3);
    expect(lookupOpportunityId('missing')).toBeNull();
  });

  it('keeps the first id seen for a name', () => {
    populateOpportunityIdCache([{ id: 3, name: 'Dup' }, { id: 4, name: 'dup' }]);
    setOpportunityId('DUP', 5);
    expect(lookupOpportunityId('dup')).toBe(3);
    expect(getOpportunityIdCacheSize()).toBe(1);
  });

  it('skips records without an id or name', () => {
    populateOpportunityIdCache([{ id: 0, name: 'zero' }, { name: 'no id' }, { id: 8 }]);
    expect(getOpportunityIdCacheSize()).toBe(0);
  });

  it('loads only real ids from storage', async () => {
    await chromeMock().storage.local.set({
      odoo_data: {
        opportunities: [
          { id: 'opp_12', name: 'Real' },
          { id: 'opp_k3j2', name: 'Hashed' },
        ],
      },
    });
    await initializeOpportunityIdCacheFromStorage();
    expect(lookupOpportunityId('real')).toBe(12);
    expect(lookupOpportunityId('hashed')).toBeNull();
  });

  it('survives an empty store', async () => {
    await initializeOpportunityIdCacheFromStorage();
    expect(getOpportunityIdCacheSize()).toBe(0);
  });
});

describe('activity id cache', () => {
  it('maps row positions to the ids of the latest page', () => {
    populateActivityIdCache([{ id: 1 }, { id: 2 }]);
    populateActivityIdCache([{ id: 3 }, { id: 4 }]);
    expect(getActivityIdArray()).toEqual([3, 4]);
    expect(lookupActivityId(1)).toBe(4);
    expect(lookupActivityId(2)).toBeNull();
    expect(lookupActivityId(-1)).toBeNull();
  });

  it('accumulates full records across pages for the session', () => {
    populateActivityIdCache([{ id: 21, summary: 'a' }]);
    populateActivityIdCache([{ id: 22, summary: 'b' }, { id: 21, summary: 'a, edited' }]);

    const records = getAllActivityRecords();
    expect([...records.keys()]).toEqual(expect.arrayContaining([21, 22]));
    expect(records.get(21)).toEqual({ id: 21, summary: 'a, edited' });
  });

  it('starts a session from the records already captured', () => {
    populateActivityIdCache([{ id: 31 }]);
    startActivityExtractionSession();
    expect(getAllSeenActivityIds().has(31)).toBe(true);
  });

  it('setActivityId appends an id once', () => {
    setActivityId('x', 9);
    setActivityId('x', 9);
    expect(getActivityIdCacheSize()).toBe(1);
  });
});
