import { useEffect, useState, useCallback, useRef } from 'react';
import type { Contact, Opportunity, Activity } from '../../shared/types';

interface StorageData {
  contacts: Contact[];
  opportunities: Opportunity[];
  activities: Activity[];
  lastSync: number;
}

interface UseStorageReturn {
  data: StorageData | null;
  loading: boolean;
  error: string | null;
  deleteRecord: (type: 'contacts' | 'opportunities' | 'activities', id: string) => Promise<void>;
  refetch: () => void;
}

export function useStorage(): UseStorageReturn {
  const [data, setData] = useState<StorageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialFetchDone = useRef(false);

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

  useEffect(() => {
    // Fetch initial data only once
    if (!initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchData();
    }

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

  const deleteRecord = useCallback(async (type: 'contacts' | 'opportunities' | 'activities', id: string) => {
    return new Promise<void>((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'DELETE_RECORD', data: { type, id } },
        (response) => {
          if (chrome.runtime.lastError) {
            setError(chrome.runtime.lastError.message || 'Unknown error');
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (response?.success) {
            fetchData(); // Refresh data
            resolve();
          } else {
            setError(response?.error || 'Failed to delete record');
            reject(new Error(response?.error || 'Failed to delete record'));
          }
        }
      );
    });
  }, [fetchData]);

  return { data, loading, error, deleteRecord, refetch: fetchData };
}
