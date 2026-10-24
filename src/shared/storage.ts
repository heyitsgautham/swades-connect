import type { StorageSchema, Contact, Opportunity, Activity } from './types';
import { waitForLock, releaseLock } from './lock';
import { StorageError } from './errors';

const STORAGE_KEY = 'odoo_data';

// Type alias for record types
type RecordType = 'contacts' | 'opportunities' | 'activities';
type RecordData = Contact | Opportunity | Activity;

const DEFAULT_DATA: StorageSchema['odoo_data'] = {
  contacts: [],
  opportunities: [],
  activities: [],
  lastSync: 0,
};

// Initialize default storage structure
export async function initializeStorage(): Promise<void> {
  const existing = await chrome.storage.local.get(STORAGE_KEY);
  if (!existing[STORAGE_KEY]) {
    await chrome.storage.local.set({
      [STORAGE_KEY]: DEFAULT_DATA,
    });
  }
}

// Get all stored data
export async function getData(): Promise<StorageSchema['odoo_data']> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return (result[STORAGE_KEY] as StorageSchema['odoo_data']) || DEFAULT_DATA;
}

// Save/merge new records with deduplication
export async function saveData(
  newContacts: Contact[],
  newOpportunities: Opportunity[],
  newActivities: Activity[],
): Promise<void> {
  const existing = await getData();

  // Merge and deduplicate by ID
  const mergedContacts = deduplicateById([...existing.contacts, ...newContacts]);
  const mergedOpportunities = deduplicateById([...existing.opportunities, ...newOpportunities]);
  const mergedActivities = deduplicateById([...existing.activities, ...newActivities]);

  await chrome.storage.local.set({
    [STORAGE_KEY]: {
      contacts: mergedContacts,
      opportunities: mergedOpportunities,
      activities: mergedActivities,
      lastSync: Date.now(),
    },
  });
}

// Delete individual record
export async function deleteRecord(type: 'contacts' | 'opportunities' | 'activities', id: string): Promise<void> {
  const existing = await getData();

  if (type === 'contacts') {
    existing.contacts = existing.contacts.filter((record) => record.id !== id);
  } else if (type === 'opportunities') {
    existing.opportunities = existing.opportunities.filter((record) => record.id !== id);
  } else if (type === 'activities') {
    existing.activities = existing.activities.filter((record) => record.id !== id);
  }

  await chrome.storage.local.set({ [STORAGE_KEY]: existing });
}

// Delete all records of a specific type
export async function deleteAllRecords(type: 'contacts' | 'opportunities' | 'activities'): Promise<void> {
  const existing = await getData();

  if (type === 'contacts') {
    existing.contacts = [];
  } else if (type === 'opportunities') {
    existing.opportunities = [];
  } else if (type === 'activities') {
    existing.activities = [];
  }

  await chrome.storage.local.set({ [STORAGE_KEY]: existing });
}

// Clear all data
export async function clearAll(): Promise<void> {
  await chrome.storage.local.clear();
  await initializeStorage();
}

// Helper: Deduplicate records by ID, keeping newer records (last one wins)
export function deduplicateById<T extends { id: string }>(records: T[]): T[] {
  const map = new Map<string, T>();
  records.forEach((record) => {
    map.set(record.id, record);
  });
  return Array.from(map.values());
}

// Result type for upsert operation
export interface UpsertResult {
  added: number;
  updated: number;
}

// Upsert one or more records by ID (with locking)
// For partial updates, merges new fields with existing record data
export async function upsertRecords(type: RecordType, records: RecordData[]): Promise<UpsertResult> {
  if (records.length === 0) {
    return { added: 0, updated: 0 };
  }

  const lockId = `upsert_${type}_${Date.now()}`;
  const acquired = await waitForLock(lockId, 5000);

  if (!acquired) {
    throw new StorageError(`Failed to acquire lock for upsert operation on ${type}`, { type, lockId });
  }

  try {
    const existing = await getData();
    const existingRecords = existing[type] as RecordData[];

    // Create a map of existing records by ID for quick lookup
    const existingMap = new Map<string, RecordData>();
    for (const rec of existingRecords) {
      existingMap.set(rec.id, rec);
    }

    let added = 0;
    let updated = 0;

    // Merge incoming records with existing ones
    for (const record of records) {
      const existingRecord = existingMap.get(record.id);

      if (existingRecord) {
        existingMap.set(record.id, mergeNonEmpty(existingRecord, record));
        updated++;
      } else {
        // Add: New record
        existingMap.set(record.id, record);
        added++;
      }
    }

    // Convert map back to array
    const mergedRecords = Array.from(existingMap.values());

    // Update the specific type array
    const updatedData: StorageSchema['odoo_data'] = {
      ...existing,
      [type]: mergedRecords,
      lastSync: Date.now(),
    };

    await chrome.storage.local.set({ [STORAGE_KEY]: updatedData });

    return { added, updated };
  } finally {
    await releaseLock(lockId);
  }
}

/**
 * Merge an incoming record into a stored one. Incoming fields win,
 * except empty strings, null and undefined, which keep the stored value.
 */
export function mergeNonEmpty<T extends object>(existing: T, incoming: T): T {
  const merged = { ...existing } as Record<string, unknown>;
  for (const [key, value] of Object.entries(incoming)) {
    if (value !== '' && value !== null && value !== undefined) {
      merged[key] = value;
    }
  }
  return merged as T;
}

/** Ids built from a real Odoo record id, as opposed to a content hash. */
const REAL_ID_PATTERN: Record<'opportunities' | 'activities', RegExp> = {
  opportunities: /^opp_\d+$/,
  activities: /^act_\d+$/,
};

const MATCH_FIELD = { opportunities: 'name', activities: 'summary' } as const;

/**
 * Upsert records whose ids can upgrade from a content hash to a real Odoo id.
 *
 * DOM extraction stores records under hash ids such as `opp_lnl5ct` when the
 * real id is unknown. When RPC sync later delivers `opp_24` for the same record,
 * no stored id matches, so the stored record with the same name (opportunities)
 * or summary (activities), compared case-insensitively, is merged and takes the
 * real id instead of a duplicate being added.
 */
export async function upsertUpgradingHashIds(
  type: 'opportunities' | 'activities',
  records: RecordData[],
): Promise<UpsertResult> {
  if (records.length === 0) {
    return { added: 0, updated: 0 };
  }

  const lockId = `upsert_${type}_match_${Date.now()}`;
  const acquired = await waitForLock(lockId, 5000);

  if (!acquired) {
    throw new StorageError(`Failed to acquire lock for upsert operation on ${type}`, { type, lockId });
  }

  try {
    const existing = await getData();
    const stored = [...(existing[type] as RecordData[])];
    const field = MATCH_FIELD[type];
    const normalize = (record: RecordData) =>
      String((record as unknown as Record<string, unknown>)[field] ?? '')
        .toLowerCase()
        .trim();

    let added = 0;
    let updated = 0;

    for (const record of records) {
      let index = stored.findIndex((item) => item.id === record.id);

      if (index === -1 && REAL_ID_PATTERN[type].test(record.id) && normalize(record)) {
        index = stored.findIndex((item) => normalize(item) === normalize(record));
      }

      if (index >= 0) {
        stored[index] = mergeNonEmpty(stored[index], record);
        updated++;
      } else {
        stored.push(record);
        added++;
      }
    }

    await chrome.storage.local.set({
      [STORAGE_KEY]: { ...existing, [type]: stored, lastSync: Date.now() },
    });

    return { added, updated };
  } finally {
    await releaseLock(lockId);
  }
}

// Delete multiple records by ID array (with locking)
export async function deleteRecordsById(type: RecordType, ids: string[]): Promise<number> {
  if (ids.length === 0) {
    return 0;
  }

  const lockId = `delete_${type}_${Date.now()}`;
  const acquired = await waitForLock(lockId, 5000);

  if (!acquired) {
    throw new StorageError(`Failed to acquire lock for delete operation on ${type}`, { type, lockId });
  }

  try {
    const existing = await getData();
    const existingRecords = existing[type] as RecordData[];
    const idsToDelete = new Set(ids);

    // Find records that will be deleted
    const recordsToKeep = existingRecords.filter((r) => !idsToDelete.has(r.id));
    const deletedCount = existingRecords.length - recordsToKeep.length;

    // Update the specific type array
    const updatedData: StorageSchema['odoo_data'] = {
      ...existing,
      [type]: recordsToKeep,
      lastSync: Date.now(),
    };

    await chrome.storage.local.set({ [STORAGE_KEY]: updatedData });

    return deletedCount;
  } finally {
    await releaseLock(lockId);
  }
}
