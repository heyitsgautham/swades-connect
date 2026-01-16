import { saveData, deleteRecord, getData, initializeStorage } from '../shared/storage';
import { acquireLock, releaseLock } from '../shared/lock';
import type { ExtensionMessage, MessageResponse } from '../shared/messages';
import type { Contact, Opportunity, Activity } from '../shared/types';

// Initialize storage on service worker startup
initializeStorage().then(() => {
  console.log('[Service Worker] Storage initialized');
});

/**
 * Main message router using hybrid async pattern for MV3
 * Chrome requires returning `true` to keep the channel open, then calling sendResponse
 * The Promise-only pattern has known issues with some Chrome versions
 * @see https://developer.chrome.com/docs/extensions/develop/concepts/messaging
 */
chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender, sendResponse: (response: MessageResponse) => void): boolean => {
    console.log('[Service Worker] Received message:', message.action, 'from', sender.url || 'popup/internal');

    // Wrap async handler to use sendResponse callback
    const handleAsync = async (): Promise<MessageResponse> => {
      switch (message.action) {
        case 'EXTRACT_DATA':
          return handleExtractRequest(sender.tab?.id);

        case 'EXTRACTION_COMPLETE':
          return handleExtractionComplete(message);

        case 'EXTRACTION_ERROR':
          return handleExtractionError(message);

        case 'GET_DATA':
          return handleGetData();

        case 'SAVE_DATA':
          return handleSaveData(message);

        case 'DELETE_RECORD':
          return handleDeleteRecord(message);

        case 'TEST':
          console.log('[Service Worker] Test message received');
          return { success: true, data: { message: 'Service worker is alive' } };

        default:
          console.warn('[Service Worker] Unknown message action:', (message as unknown as { action: string }).action);
          return { success: false, error: 'Unknown action' };
      }
    };

    // Execute async handler and send response
    handleAsync()
      .then(sendResponse)
      .catch((error) => {
        console.error('[Service Worker] Handler error:', error);
        sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
      });

    // Return true to indicate we will send response asynchronously
    return true;
  }
);

/**
 * Handler: Extract data from active tab
 * Uses chrome.tabs.sendMessage to communicate with content script
 * If tabId is not provided (e.g., from popup), queries for active tab
 */
async function handleExtractRequest(tabId: number | undefined): Promise<MessageResponse> {
  let targetTabId = tabId;

  // If no tabId provided (message from popup), get the active tab
  if (!targetTabId) {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      targetTabId = tabs[0]?.id;
    } catch (error) {
      console.error('[Service Worker] Error querying active tab:', error);
    }
  }

  if (!targetTabId) {
    return { success: false, error: 'No active tab found. Please open an Odoo page first.' };
  }

  try {
    // Use promise-based chrome.tabs.sendMessage (MV3 pattern)
    const response = await chrome.tabs.sendMessage(targetTabId, { action: 'EXTRACT_DATA' });
    console.log('[Service Worker] Extraction response from content script:', response);
    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Service Worker] Error sending to content script:', errorMessage);
    
    // Provide a more helpful error message
    if (errorMessage.includes('Receiving end does not exist')) {
      return { 
        success: false, 
        error: 'Content script not loaded. Make sure you are on an Odoo page and refresh if needed.' 
      };
    }
    return { success: false, error: errorMessage };
  }
}

/**
 * Handler: Process extraction complete
 * Saves extracted data to storage with lock protection
 */
async function handleExtractionComplete(message: ExtensionMessage): Promise<MessageResponse> {
  const lockId = `extraction_${Date.now()}`;

  try {
    const locked = await acquireLock(lockId);
    if (!locked) {
      return { success: false, error: 'Could not acquire lock' };
    }

    const { contacts, opportunities, activities } = (message as unknown as { data: { contacts: Contact[]; opportunities: Opportunity[]; activities: Activity[] } }).data;

    await saveData(contacts, opportunities, activities);

    console.log('[Service Worker] Data saved to storage:', {
      contactsCount: contacts.length,
      opportunitiesCount: opportunities.length,
      activitiesCount: activities.length,
    });

    // Broadcast update to all popups (fire and forget)
    broadcastStorageUpdate();

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Service Worker] Error processing extraction:', errorMessage);
    return { success: false, error: errorMessage };
  } finally {
    await releaseLock(lockId);
  }
}

/**
 * Handler: Process extraction error from content script
 */
async function handleExtractionError(message: ExtensionMessage): Promise<MessageResponse> {
  console.error('[Service Worker] Extraction error reported:', message.error);
  return { success: true, data: { acknowledgement: 'Error logged' } };
}

/**
 * Handler: Get all stored data
 */
async function handleGetData(): Promise<MessageResponse> {
  try {
    const data = await getData();
    return { success: true, data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Service Worker] Error retrieving data:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Handler: Save/merge data to storage
 */
async function handleSaveData(message: ExtensionMessage): Promise<MessageResponse> {
  const lockId = `save_${Date.now()}`;

  try {
    const locked = await acquireLock(lockId);
    if (!locked) {
      return { success: false, error: 'Could not acquire lock' };
    }

    const messageData = (message as unknown as { data: { contacts?: Contact[]; opportunities?: Opportunity[]; activities?: Activity[] } }).data;
    const { contacts = [], opportunities = [], activities = [] } = messageData;

    await saveData(contacts, opportunities, activities);
    broadcastStorageUpdate();

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Service Worker] Error saving data:', errorMessage);
    return { success: false, error: errorMessage };
  } finally {
    await releaseLock(lockId);
  }
}

/**
 * Handler: Delete individual record
 */
async function handleDeleteRecord(message: ExtensionMessage): Promise<MessageResponse> {
  try {
    const { type, id } = (message as unknown as { data: { type: 'contacts' | 'opportunities' | 'activities'; id: string } }).data;

    if (!type || !id) {
      return { success: false, error: 'Missing type or id' };
    }

    await deleteRecord(type, id);
    broadcastStorageUpdate();

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Service Worker] Error deleting record:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

// Utility: Broadcast storage update to all listeners
async function broadcastStorageUpdate() {
  try {
    const data = await getData();

    // Broadcast to all popup windows
    chrome.runtime.sendMessage(
      {
        action: 'STORAGE_UPDATED',
        data,
      },
      () => {
        // Ignore errors if no popup is listening
        if (chrome.runtime.lastError) {
          console.debug('No popup listening for storage update');
        }
      }
    );
  } catch (error) {
    console.error('Error broadcasting storage update:', error);
  }
}

// Listen to storage changes directly
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.odoo_data) {
    console.log('Local storage changed, broadcasting update');
    broadcastStorageUpdate();
  }
});

// Handle extension uninstall
chrome.runtime.setUninstallURL('https://github.com/heyitsgautham/swades-connect');
