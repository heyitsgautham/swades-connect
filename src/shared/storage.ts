import type { StorageSchema, Contact, Opportunity, Activity } from './types';

const STORAGE_KEY = 'odoo_data';

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
  newActivities: Activity[]
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
export async function deleteRecord(
  type: 'contacts' | 'opportunities' | 'activities',
  id: string
): Promise<void> {
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
