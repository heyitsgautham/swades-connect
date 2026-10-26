import { useEffect, useState, useCallback } from 'react';
import type { DataType, StoredData } from '../../shared/messages';
import { describeError } from '../../shared/logger';
import { deleteAllStoredRecords, deleteStoredRecord, fetchStoredData, parseStorageUpdate } from '../background';

interface DeleteResult {
  success: boolean;
  error?: string;
}

interface UseStorageReturn {
  data: StoredData | null;
  loading: boolean;
  error: string | null;
  deleteRecord: (type: DataType, id: string) => Promise<DeleteResult>;
  optimisticDelete: (type: DataType, id: string) => () => void;
  deleteAllRecords: (type: DataType) => Promise<DeleteResult>;
  refetch: () => void;
}

export function useStorage(): UseStorageReturn {
  const [data, setData] = useState<StoredData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Only the first load shows the loading screen. A refresh after a delete or an extraction
  // keeps the tabs mounted, so their search and filter state survives.
  const fetchData = useCallback(
    () =>
      fetchStoredData().then(
        (stored) => {
          setData(stored);
          setError(null);
          setLoading(false);
        },
        (fetchError: unknown) => {
          setError(describeError(fetchError));
          setLoading(false);
        },
      ),
    [],
  );

  // Fetch once, then follow the service worker's STORAGE_UPDATED broadcasts.
  useEffect(() => {
    void fetchData();

    const handleMessage = (message: unknown) => {
      const update = parseStorageUpdate(message);
      if (update) setData(update);
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [fetchData]);

  // Delete failures go back to the caller, which reports them in a toast.
  // They stay out of `error`, which drives the banner for load failures and would otherwise never clear.
  const runDelete = useCallback(
    async (remove: () => Promise<void>): Promise<DeleteResult> => {
      try {
        await remove();
        void fetchData();
        return { success: true };
      } catch (deleteError) {
        return { success: false, error: describeError(deleteError) };
      }
    },
    [fetchData],
  );

  const deleteRecord = useCallback(
    (type: DataType, id: string) => runDelete(() => deleteStoredRecord(type, id)),
    [runDelete],
  );

  const deleteAllRecords = useCallback((type: DataType) => runDelete(() => deleteAllStoredRecords(type)), [runDelete]);

  // Optimistic delete: immediately removes the item from UI state and returns a rollback function.
  const optimisticDelete = useCallback(
    (type: DataType, id: string): (() => void) => {
      const previousData = data;

      setData((prev) => {
        if (!prev) return prev;
        return { ...prev, [type]: prev[type].filter((item) => item.id !== id) };
      });

      return () => {
        if (previousData) setData(previousData);
      };
    },
    [data],
  );

  return {
    data,
    loading,
    error,
    deleteRecord,
    optimisticDelete,
    deleteAllRecords,
    refetch: () => void fetchData(),
  };
}
