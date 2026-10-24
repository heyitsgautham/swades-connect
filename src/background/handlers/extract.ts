import { acquireLock, releaseLock } from '../../shared/lock';
import { createLogger, describeError } from '../../shared/logger';
import type { MessageResponse } from '../../shared/messages';
import type { BackgroundMessage } from '../../shared/schemas';
import { saveData } from '../../shared/storage';
import { broadcastStorageUpdate } from '../broadcast';

const log = createLogger('background');

type Of<A extends BackgroundMessage['action']> = Extract<BackgroundMessage, { action: A }>;

/**
 * Ask the content script in a tab to extract. Messages from the popup carry
 * no tab, so the active tab of the current window is used.
 */
export async function handleExtractRequest(tabId: number | undefined): Promise<MessageResponse> {
  let targetTabId = tabId;

  if (!targetTabId) {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      targetTabId = tabs[0]?.id;
    } catch (error) {
      log.error('Error querying active tab', { error: describeError(error) });
    }
  }

  if (!targetTabId) {
    return { success: false, error: 'No active tab found. Please open an Odoo page first.' };
  }

  try {
    const response = (await chrome.tabs.sendMessage(targetTabId, { action: 'EXTRACT_DATA' })) as MessageResponse;
    log.debug('Extraction response from content script', { response });
    return response;
  } catch (error) {
    const errorMessage = describeError(error);
    log.error('Error sending to content script', { error: errorMessage });

    if (errorMessage.includes('Receiving end does not exist')) {
      return {
        success: false,
        error: 'Content script not loaded. Make sure you are on an Odoo page and refresh if needed.',
      };
    }
    return { success: false, error: errorMessage };
  }
}

/** Store the records a full-page extraction produced. */
export async function handleExtractionComplete(message: Of<'EXTRACTION_COMPLETE'>): Promise<MessageResponse> {
  const lockId = `extraction_${Date.now()}`;

  try {
    if (!(await acquireLock(lockId))) {
      return { success: false, error: 'Could not acquire lock' };
    }

    const { contacts, opportunities, activities, metadata } = message.data;
    await saveData(contacts, opportunities, activities);

    log.info('Extraction saved', {
      contacts: contacts.length,
      opportunities: opportunities.length,
      activities: activities.length,
      extractionTimeMs: metadata?.extractionTimeMs,
    });

    void broadcastStorageUpdate();
    return { success: true };
  } catch (error) {
    const errorMessage = describeError(error);
    log.error('Error processing extraction', { error: errorMessage });
    return { success: false, error: errorMessage };
  } finally {
    await releaseLock(lockId);
  }
}

export async function handleExtractionError(message: Of<'EXTRACTION_ERROR'>): Promise<MessageResponse> {
  log.error('Content script reported an extraction error', { error: message.error });
  return { success: true, data: { acknowledgement: 'Error logged' } };
}
