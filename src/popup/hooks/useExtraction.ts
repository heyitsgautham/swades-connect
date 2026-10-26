import { useState, useCallback } from 'react';
import { describeError } from '../../shared/logger';
import { requestExtraction } from '../background';

interface ExtractionState {
  isExtracting: boolean;
  error: string | null;
  success: boolean;
  recordsExtracted: number;
}

/**
 * React hook for triggering data extraction from the popup.
 * The service worker forwards EXTRACT_DATA to the active tab's content script.
 */
export function useExtraction() {
  const [state, setState] = useState<ExtractionState>({
    isExtracting: false,
    error: null,
    success: false,
    recordsExtracted: 0,
  });

  const triggerExtraction = useCallback(async () => {
    setState({ isExtracting: true, error: null, success: false, recordsExtracted: 0 });

    try {
      // Get active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs[0];

      if (!activeTab?.id) {
        throw new Error('No active tab found');
      }

      const recordsExtracted = await requestExtraction();
      setState({ isExtracting: false, error: null, success: true, recordsExtracted });
    } catch (error) {
      setState({ isExtracting: false, error: describeError(error), success: false, recordsExtracted: 0 });
    }
  }, []);

  const clearState = useCallback(() => {
    setState({ isExtracting: false, error: null, success: false, recordsExtracted: 0 });
  }, []);

  return { ...state, triggerExtraction, clearState };
}
