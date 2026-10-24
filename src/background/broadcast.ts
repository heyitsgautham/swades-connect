import { createLogger, describeError } from '../shared/logger';
import { getData } from '../shared/storage';

const log = createLogger('background');

/** Send the current stored data to any open popup. */
export async function broadcastStorageUpdate(): Promise<void> {
  try {
    const data = await getData();
    chrome.runtime.sendMessage({ action: 'STORAGE_UPDATED', data }, () => {
      // Reading lastError marks it handled; it is set whenever no popup is open.
      if (chrome.runtime.lastError) {
        log.debug('No popup listening for storage update');
      }
    });
  } catch (error) {
    log.error('Error broadcasting storage update', { error: describeError(error) });
  }
}
