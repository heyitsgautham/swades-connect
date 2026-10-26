import { useCallback, useEffect, useState } from 'react';
import { notifyActiveTab } from '../activeTab';

/** The two sync switches in Settings: the storage key each one persists to and the message that applies it live. */
export const SYNC_PREFERENCES = {
  rpcSync: { key: 'rpc_sync_enabled', action: 'TOGGLE_RPC_SYNC' },
  autoExtract: { key: 'auto_extract_enabled', action: 'TOGGLE_AUTO_EXTRACT' },
} as const;

export type SyncPreference = keyof typeof SYNC_PREFERENCES;

/**
 * One on/off sync preference.
 * Reads the stored value on mount. Toggling saves the new value, then tells the active tab,
 * which only an open Odoo tab answers; other tabs read the stored value on their next load.
 */
export function useSyncPreference(preference: SyncPreference): [enabled: boolean, toggle: () => Promise<void>] {
  const { key, action } = SYNC_PREFERENCES[preference];
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    chrome.storage.local.get([key], (result) => setEnabled(!!result[key]));
  }, [key]);

  const toggle = useCallback(async () => {
    const next = !enabled;
    setEnabled(next);
    await chrome.storage.local.set({ [key]: next });
    await notifyActiveTab({ action, enabled: next });
  }, [enabled, key, action]);

  return [enabled, toggle];
}
