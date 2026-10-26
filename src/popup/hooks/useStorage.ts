import { useEffect, useState, useCallback } from 'react';
import type { Contact, Opportunity, Activity } from '../../shared/types';

interface StorageData {
  contacts: Contact[];
  opportunities: Opportunity[];
  activities: Activity[];
  lastSync: number;
}

interface DeleteResult {
  success: boolean;
  error?: string;
}

interface UseStorageReturn {
  data: StorageData | null;
  loading: boolean;
  error: string | null;
  deleteRecord: (type: 'contacts' | 'opportunities' | 'activities', id: string) => Promise<DeleteResult>;
  optimisticDelete: (type: 'contacts' | 'opportunities' | 'activities', id: string) => () => void;
  deleteAllRecords: (type: 'contacts' | 'opportunities' | 'activities') => Promise<DeleteResult>;
  refetch: () => void;
}

export function useStorage(): UseStorageReturn {
  const [data, setData] = useState<StorageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Only the first load shows the loading screen. A refresh after a delete or an extraction
  // keeps the tabs mounted, so their search and filter state survives.
  const fetchData = useCallback(() => {
    chrome.runtime.sendMessage({ action: 'GET_DATA' }, (response) => {
      if (chrome.runtime.lastError) {
        setError(chrome.runtime.lastError.message || 'Unknown error');
        setLoading(false);
        return;
      }
      if (response?.success) {
        setData(response.data);
        setError(null);
      } else {
        setError(response?.error || 'Failed to fetch data');
      }
      setLoading(false);
    });
  }, []);

  // Listen for storage changes and fetch initial data
  useEffect(() => {
    fetchData();

    // Listen for storage changes from service worker
    const handleMessage = (message: { action: string; data?: StorageData }) => {
      if (message.action === 'STORAGE_UPDATED' && message.data) {
        setData(message.data);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [fetchData]);

  // Delete failures go back to the caller, which reports them in a toast.
  // They stay out of `error`, which drives the banner for load failures and would otherwise never clear.
  const sendDelete = useCallback(
    (message: object, fallbackError: string): Promise<DeleteResult> =>
      new Promise<DeleteResult>((resolve) => {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: chrome.runtime.lastError.message || fallbackError });
            return;
          }
          if (response?.success) {
            fetchData();
            resolve({ success: true });
          } else {
            resolve({ success: false, error: response?.error || fallbackError });
          }
        });
      }),
    [fetchData],
  );

  const deleteRecord = useCallback(
    (type: 'contacts' | 'opportunities' | 'activities', id: string) =>
      sendDelete({ action: 'DELETE_RECORD', data: { type, id } }, 'Failed to delete record'),
    [sendDelete],
  );

  // Optimistic delete: immediately removes item from UI state and returns a rollback function
  const optimisticDelete = useCallback(
    (type: 'contacts' | 'opportunities' | 'activities', id: string): (() => void) => {
      // Save current state for potential rollback
      const previousData = data;

      // Immediately update UI state
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          [type]: prev[type].filter((item: Contact | Opportunity | Activity) => item.id !== id),
        };
      });

      // Return rollback function
      return () => {
        if (previousData) {
          setData(previousData);
        }
      };
    },
    [data],
  );

  const deleteAllRecords = useCallback(
    (type: 'contacts' | 'opportunities' | 'activities') =>
      sendDelete({ action: 'DELETE_ALL_RECORDS', data: { type } }, 'Failed to delete all records'),
    [sendDelete],
  );

  return { data, loading, error, deleteRecord, optimisticDelete, deleteAllRecords, refetch: fetchData };
}
