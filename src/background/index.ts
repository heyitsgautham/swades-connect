/**
 * Service worker entry point.
 *
 * Owns chrome.storage writes for extracted data. Messages from the popup and
 * content scripts go through routeMessage, which validates them before any
 * handler runs. Every change to stored data is broadcast to open popups.
 */

import { createLogger, describeError, initLoggingFromStorage } from '../shared/logger';
import type { MessageResponse } from '../shared/messages';
import { initializeStorage } from '../shared/storage';
import { broadcastStorageUpdate } from './broadcast';
import { routeMessage } from './router';

const log = createLogger('background');

void initLoggingFromStorage();

initializeStorage()
  .then(() => log.debug('Storage initialized'))
  .catch((error) => log.error('Storage initialization failed', { error: describeError(error) }));

/**
 * Uses the sendResponse callback and returns true to keep the channel open,
 * because the promise-only pattern is unreliable in some Chrome versions.
 * @see https://developer.chrome.com/docs/extensions/develop/concepts/messaging
 */
chrome.runtime.onMessage.addListener(
  (message: unknown, sender, sendResponse: (response: MessageResponse) => void): boolean => {
    routeMessage(message, sender)
      .then(sendResponse)
      .catch((error) => {
        log.error('Handler error', { error: describeError(error) });
        sendResponse({ success: false, error: describeError(error) });
      });
    return true;
  },
);

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.odoo_data) {
    log.debug('Stored data changed, broadcasting update');
    void broadcastStorageUpdate();
  }
});

chrome.runtime.setUninstallURL('https://github.com/heyitsgautham/swades-connect');
