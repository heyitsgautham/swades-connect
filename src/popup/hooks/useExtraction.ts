import { useState, useCallback } from 'react';
import type { MessageResponse } from '../../shared/messages';

interface ExtractionState {
  isExtracting: boolean;
  error: string | null;
  success: boolean;
  recordsExtracted: number;
}

/**
 * React hook for triggering data extraction from the popup
 * Uses modern async/await Promise pattern (MV3 2025 Best Practice)
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

      // Send extraction request to service worker using modern Promise-based API
      const response: MessageResponse = await chrome.runtime.sendMessage({ action: 'EXTRACT_DATA' });

      if (response.success) {
        const recordsExtracted = (response.data as { recordsExtracted?: number })?.recordsExtracted || 0;
        setState({ 
          isExtracting: false, 
          error: null, 
          success: true, 
          recordsExtracted,
        });
      } else {
        setState({
          isExtracting: false,
          error: response.error || 'Unknown error',
          success: false,
          recordsExtracted: 0,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setState({
        isExtracting: false,
        error: errorMessage,
        success: false,
        recordsExtracted: 0,
      });
    }
  }, []);

  const clearState = useCallback(() => {
    setState({ isExtracting: false, error: null, success: false, recordsExtracted: 0 });
  }, []);

  return { ...state, triggerExtraction, clearState };
}
