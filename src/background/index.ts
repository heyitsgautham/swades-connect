// Service Worker - handles message routing and storage operations
import { saveData, deleteRecord, getData, initializeStorage } from '../shared/storage';
import { acquireLock, releaseLock } from '../shared/lock';

console.log('🚀 Swades Connect Service Worker loaded');

// Initialize storage on service worker startup
initializeStorage().then(() => {
  console.log('✅ Storage initialized');
}).catch((error) => {
  console.error('❌ Storage initialization failed:', error);
});

// Keep service worker alive
function keepAlive() {
  const keepAliveInterval = setInterval(() => {
    console.log('⏰ Service worker keepalive ping');
  }, 20000);
  return keepAliveInterval;
}
keepAlive();

// Message handler
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('📨 Message received in service worker:', message);

  if (message.action === 'SAVE_DATA') {
    handleSaveData(message, sendResponse);
    return true; // Keep channel open for async response
  } else if (message.action === 'DELETE_RECORD') {
    handleDeleteRecord(message, sendResponse);
    return true;
  } else if (message.action === 'GET_DATA') {
    handleGetData(sendResponse);
    return true;
  }

  sendResponse({ status: 'acknowledged' });
  return true;
});

console.log('✅ Message listener registered');

async function handleSaveData(message: { data: { contacts?: unknown[]; opportunities?: unknown[]; activities?: unknown[] } }, sendResponse: (response: { success: boolean; error?: string }) => void) {
  const lockId = `save_${Date.now()}`;

  try {
    // Acquire lock to prevent concurrent writes
    const locked = await acquireLock(lockId);
    if (!locked) {
      sendResponse({ success: false, error: 'Could not acquire lock' });
      return;
    }

    const { contacts, opportunities, activities } = message.data;
    await saveData(
      (contacts || []) as Parameters<typeof saveData>[0],
      (opportunities || []) as Parameters<typeof saveData>[1],
      (activities || []) as Parameters<typeof saveData>[2]
    );

    // Broadcast update to all popups
    chrome.runtime.sendMessage({
      action: 'STORAGE_UPDATED',
      data: await getData(),
    }).catch(() => {
      // Ignore errors if no popup is open
    });

    sendResponse({ success: true });
  } catch (error) {
    console.error('Error saving data:', error);
    sendResponse({ success: false, error: String(error) });
  } finally {
    await releaseLock(lockId);
  }
}

async function handleDeleteRecord(message: { data: { type: 'contacts' | 'opportunities' | 'activities'; id: string } }, sendResponse: (response: { success: boolean; error?: string }) => void) {
  try {
    const { type, id } = message.data;
    await deleteRecord(type, id);
    
    // Broadcast update after delete
    chrome.runtime.sendMessage({
      action: 'STORAGE_UPDATED',
      data: await getData(),
    }).catch(() => {
      // Ignore errors if no popup is open
    });
    
    sendResponse({ success: true });
  } catch (error) {
    console.error('Error deleting record:', error);
    sendResponse({ success: false, error: String(error) });
  }
}

async function handleGetData(sendResponse: (response: { success: boolean; data?: Awaited<ReturnType<typeof getData>>; error?: string }) => void) {
  try {
    const data = await getData();
    sendResponse({ success: true, data });
  } catch (error) {
    console.error('Error retrieving data:', error);
    sendResponse({ success: false, error: String(error) });
  }
}

// Listen to storage changes and broadcast to all listeners
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.odoo_data) {
    console.log('Storage updated, broadcasting to popups');
    chrome.runtime.sendMessage({
      action: 'STORAGE_UPDATED',
      data: changes.odoo_data.newValue,
    }).catch(() => {
      // Ignore errors if no popup is listening
    });
  }
});
