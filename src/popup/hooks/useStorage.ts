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

  const fetchData = useCallback(() => {
    setLoading(true);
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
    // Initial fetch - chrome.runtime.sendMessage uses callbacks, so setState is in callback
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
  }, []);

  const deleteRecord = useCallback(async (type: 'contacts' | 'opportunities' | 'activities', id: string): Promise<DeleteResult> => {
    return new Promise<DeleteResult>((resolve) => {
      chrome.runtime.sendMessage(
        { action: 'DELETE_RECORD', data: { type, id } },
        (response) => {
          if (chrome.runtime.lastError) {
            setError(chrome.runtime.lastError.message || 'Unknown error');
            resolve({ success: false, error: chrome.runtime.lastError.message });
            return;
          }
          if (response?.success) {
            fetchData(); // Refresh data
            resolve({ success: true });
          } else {
            const errorMsg = response?.error || 'Failed to delete record';
            setError(errorMsg);
            resolve({ success: false, error: errorMsg });
          }
        }
      );
    });
  }, [fetchData]);

  // Optimistic delete: immediately removes item from UI state and returns a rollback function
  const optimisticDelete = useCallback((type: 'contacts' | 'opportunities' | 'activities', id: string): () => void => {
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
  }, [data]);

  const deleteAllRecords = useCallback(async (type: 'contacts' | 'opportunities' | 'activities'): Promise<DeleteResult> => {
    return new Promise<DeleteResult>((resolve) => {
      chrome.runtime.sendMessage(
        { action: 'DELETE_ALL_RECORDS', data: { type } },
        (response) => {
          if (chrome.runtime.lastError) {
            setError(chrome.runtime.lastError.message || 'Unknown error');
            resolve({ success: false, error: chrome.runtime.lastError.message });
            return;
          }
          if (response?.success) {
            fetchData(); // Refresh data
            resolve({ success: true });
          } else {
            const errorMsg = response?.error || 'Failed to delete all records';
            setError(errorMsg);
            resolve({ success: false, error: errorMsg });
          }
        }
      );
    });
  }, [fetchData]);

  return { data, loading, error, deleteRecord, optimisticDelete, deleteAllRecords, refetch: fetchData };
}
