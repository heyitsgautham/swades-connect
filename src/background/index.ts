import { saveData, deleteRecord, deleteAllRecords, getData, initializeStorage, upsertRecords, deleteRecordsById } from '../shared/storage';
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

        case 'DELETE_ALL_RECORDS':
          return handleDeleteAllRecords(message);

        case 'UPDATE_BADGE':
          return handleUpdateBadge(message);

        case 'ODOO_RPC_UPSERT':
          return handleRpcUpsert(message);

        case 'ODOO_RPC_DELETE':
          return handleRpcDelete(message);

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

/**
 * Handler: Delete all records of a specific type
 */
async function handleDeleteAllRecords(message: ExtensionMessage): Promise<MessageResponse> {
  try {
    const { type } = (message as unknown as { data: { type: 'contacts' | 'opportunities' | 'activities' } }).data;

    if (!type) {
      return { success: false, error: 'Missing type' };
    }

    await deleteAllRecords(type);
    broadcastStorageUpdate();

    console.log(`[Service Worker] Deleted all ${type}`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Service Worker] Error deleting all records:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Handler: Update extension badge
 */
async function handleUpdateBadge(message: ExtensionMessage): Promise<MessageResponse> {
  try {
    const { text } = (message as unknown as { data: { text: string } }).data;

    await chrome.action.setBadgeText({ text });
    
    if (text) {
      await chrome.action.setBadgeBackgroundColor({ color: '#16a34a' }); // Green
    }

    console.log(`[Service Worker] Badge updated: ${text}`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Service Worker] Error updating badge:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Handler: Upsert records from RPC interception
 * For opportunities with real IDs, also tries matching by name to upgrade hash IDs
 * For activities with real IDs, also tries matching by summary to upgrade hash IDs
 */
async function handleRpcUpsert(message: ExtensionMessage): Promise<MessageResponse> {
  try {
    const { type, records } = (message as unknown as { data: { type: 'contacts' | 'opportunities' | 'activities'; records: unknown[] } }).data;

    if (!type || !records) {
      return { success: false, error: 'Missing type or records' };
    }

    // For opportunities, implement name-matching to upgrade hash IDs to real IDs
    if (type === 'opportunities') {
      const result = await upsertOpportunitiesWithNameMatching(records as Opportunity[]);
      console.log(`[RPC Sync] Upserted ${result.added} new, ${result.updated} updated ${type}`);
      await broadcastStorageUpdate();
      return { success: true, data: result };
    }

    // For activities, implement summary-matching to upgrade hash IDs to real IDs
    if (type === 'activities') {
      const result = await upsertActivitiesWithSummaryMatching(records as Activity[]);
      console.log(`[RPC Sync] Upserted ${result.added} new, ${result.updated} updated ${type}`);
      await broadcastStorageUpdate();
      return { success: true, data: result };
    }

    const result = await upsertRecords(type, records as Contact[] | Opportunity[] | Activity[]);
    console.log(`[RPC Sync] Upserted ${result.added} new, ${result.updated} updated ${type}`);

    // Broadcast update to popup
    await broadcastStorageUpdate();

    return { success: true, data: result };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Service Worker] Error in RPC upsert:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Upsert opportunities with name-matching logic to handle hash ID → real ID upgrades
 * 
 * Problem: DOM extraction creates hash-based IDs like `opp_lnl5ct`, but RPC edit
 * captures real IDs like `opp_24` for the same opportunity.
 * 
 * Solution: When upserting with a real ID that doesn't match any existing ID,
 * try to find by name match and upgrade the record's ID to the real ID.
 */
async function upsertOpportunitiesWithNameMatching(
  records: Opportunity[]
): Promise<{ added: number; updated: number }> {
  const lockId = `upsert_opportunities_name_${Date.now()}`;
  const acquired = await acquireLock(lockId);
  
  if (!acquired) {
    throw new Error('Failed to acquire lock for opportunity upsert with name matching');
  }
  
  try {
    const data = await getData();
    let added = 0;
    let updated = 0;
    
    for (const record of records) {
      const isRealId = /^opp_\d+$/.test(record.id);
      let existingIndex = data.opportunities.findIndex(item => item.id === record.id);
      
      // If not found by ID and this is a real ID, try matching by name
      if (existingIndex === -1 && isRealId && record.name) {
        const recordName = record.name.toLowerCase().trim();
        existingIndex = data.opportunities.findIndex(item =>
          item.name && item.name.toLowerCase().trim() === recordName
        );
        
        if (existingIndex !== -1) {
          console.log(`[RPC Sync] Upgrading opportunity ID: ${data.opportunities[existingIndex].id} → ${record.id} (matched by name: "${record.name}")`);
        }
      }
      
      if (existingIndex >= 0) {
        // Merge: existing record with new fields (new non-empty fields take precedence)
        const existingRecord = data.opportunities[existingIndex];
        const mergedRecord = { ...existingRecord };
        for (const [key, value] of Object.entries(record)) {
          if (value !== '' && value !== null && value !== undefined) {
            (mergedRecord as Record<string, unknown>)[key] = value;
          }
        }
        data.opportunities[existingIndex] = mergedRecord;
        updated++;
      } else {
        data.opportunities.push(record);
        added++;
      }
    }
    
    // Save updated data
    await chrome.storage.local.set({
      odoo_data: {
        ...data,
        lastSync: Date.now(),
      },
    });
    
    return { added, updated };
  } finally {
    await releaseLock(lockId);
  }
}

/**
 * Upsert activities with summary-matching logic to handle hash ID → real ID upgrades
 * 
 * Problem: DOM extraction creates hash-based IDs like `act_lnl5ct`, but RPC edit
 * captures real IDs like `act_10` for the same activity.
 * 
 * Solution: When upserting with a real ID that doesn't match any existing ID,
 * try to find by summary match and upgrade the record's ID to the real ID.
 */
async function upsertActivitiesWithSummaryMatching(
  records: Activity[]
): Promise<{ added: number; updated: number }> {
  const lockId = `upsert_activities_summary_${Date.now()}`;
  const acquired = await acquireLock(lockId);
  
  if (!acquired) {
    throw new Error('Failed to acquire lock for activity upsert with summary matching');
  }
  
  try {
    const data = await getData();
    let added = 0;
    let updated = 0;
    
    for (const record of records) {
      const isRealId = /^act_\d+$/.test(record.id);
      let existingIndex = data.activities.findIndex(item => item.id === record.id);
      
      // If not found by ID and this is a real ID, try matching by summary
      if (existingIndex === -1 && isRealId && record.summary) {
        const recordSummary = record.summary.toLowerCase().trim();
        existingIndex = data.activities.findIndex(item =>
          item.summary && item.summary.toLowerCase().trim() === recordSummary
        );
        
        if (existingIndex !== -1) {
          console.log(`[RPC Sync] Upgrading activity ID: ${data.activities[existingIndex].id} → ${record.id} (matched by summary: "${record.summary}")`);
        }
      }
      
      if (existingIndex >= 0) {
        // Merge: existing record with new fields (new non-empty fields take precedence)
        const existingRecord = data.activities[existingIndex];
        const mergedRecord = { ...existingRecord };
        for (const [key, value] of Object.entries(record)) {
          if (value !== '' && value !== null && value !== undefined) {
            (mergedRecord as Record<string, unknown>)[key] = value;
          }
        }
        data.activities[existingIndex] = mergedRecord;
        updated++;
      } else {
        data.activities.push(record);
        added++;
      }
    }
    
    // Save updated data
    await chrome.storage.local.set({
      odoo_data: {
        ...data,
        lastSync: Date.now(),
      },
    });
    
    return { added, updated };
  } finally {
    await releaseLock(lockId);
  }
}

/**
 * Handler: Delete records from RPC interception
 * 
 * Known limitation: If a record was DOM-extracted (has hash-based ID like `opp_lnl5ct`)
 * and then deleted in Odoo before any RPC edit (which would upgrade to real ID),
 * the delete will fail because we only receive the real ID (`opp_17`) from RPC but
 * storage has the hash ID. The user would need to re-extract to clean up orphaned records.
 */
async function handleRpcDelete(message: ExtensionMessage): Promise<MessageResponse> {
  try {
    const { type, ids } = (message as unknown as { data: { type: 'contacts' | 'opportunities' | 'activities'; ids: string[] } }).data;

    if (!type || !ids) {
      return { success: false, error: 'Missing type or ids' };
    }

    console.log(`[RPC Sync] Delete request for ${type}: IDs = [${ids.join(', ')}]`);

    const deleted = await deleteRecordsById(type, ids);
    
    if (deleted === 0) {
      // Deletion failed - likely due to hash ID vs real ID mismatch
      console.warn(
        `[RPC Sync] ⚠️ Could not delete ${type}: None of [${ids.join(', ')}] found in storage.\n` +
        `This can happen when records were DOM-extracted (hash IDs) but deleted before any RPC edit.\n` +
        `Re-extract the page to clean up orphaned records.`
      );
    } else if (deleted < ids.length) {
      console.warn(
        `[RPC Sync] Partial delete: ${deleted}/${ids.length} ${type} deleted. ` +
        `Some records may have hash-based IDs that couldn't be matched.`
      );
    } else {
      console.log(`[RPC Sync] ✓ Deleted ${deleted} ${type}`);
    }

    // Broadcast update to popup
    await broadcastStorageUpdate();

    return { success: true, data: { deleted } };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Service Worker] Error in RPC delete:', errorMessage);
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
