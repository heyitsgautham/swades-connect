import type { StorageSchema } from './types';

const STORAGE_KEY = 'odoo_data';

const DEFAULT_DATA: StorageSchema['odoo_data'] = {
  contacts: [],
  opportunities: [],
  activities: [],
  lastSync: 0,
};

export async function getStoredData(): Promise<StorageSchema['odoo_data']> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return (result[STORAGE_KEY] as StorageSchema['odoo_data']) || DEFAULT_DATA;
}

export async function setStoredData(data: StorageSchema['odoo_data']): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: data });
}

export async function clearStoredData(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
}
