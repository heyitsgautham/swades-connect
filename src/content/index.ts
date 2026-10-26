/**
 * Content script entry point, injected at document_start on Odoo pages.
 *
 * It injects the page-level RPC interceptor before Odoo loads data, mounts
 * the status indicator, restores the auto-extract and RPC sync settings, and
 * answers EXTRACT_DATA, TOGGLE_AUTO_EXTRACT and TOGGLE_RPC_SYNC messages.
 */

import { mountIndicator } from '../injected/indicator';
import { injectRpcInterceptor } from '../injected/rpcInterceptor';
import { createLogger, describeError, initLoggingFromStorage } from '../shared/logger';
import type { MessageResponse } from '../shared/messages';
import { parseContentMessage } from '../shared/schemas';
import { handleExtraction, startAutoExtract, stopAutoExtract } from './extraction';
import { startRpcSync, stopRpcSync } from './rpcSync';

const log = createLogger('content');

void initLoggingFromStorage();
log.debug('Content script loaded', { url: window.location.href });

// Inject the RPC interceptor immediately, before Odoo issues its first
// web_search_read, so the real record ids are captured.
injectRpcInterceptor();

// At document_start the body may not exist yet.
if (document.body) {
  mountIndicator();
} else {
  document.addEventListener('DOMContentLoaded', () => mountIndicator());
}

chrome.storage.local.get(['auto_extract_enabled', 'rpc_sync_enabled'], (result) => {
  if (result.auto_extract_enabled) startAutoExtract();
  if (result.rpc_sync_enabled) startRpcSync();
});

/**
 * Uses the sendResponse callback and returns true for async replies,
 * which is the pattern Chrome documents as reliable for MV3.
 * @see https://developer.chrome.com/docs/extensions/develop/concepts/messaging
 */
chrome.runtime.onMessage.addListener(
  (raw: unknown, _sender, sendResponse: (response: MessageResponse) => void): boolean => {
    const parsed = parseContentMessage(raw);
    if (!parsed.ok) {
      if (parsed.reason === 'unknown-action') return false; // Not addressed to the content script.
      log.warn('Rejected malformed message', { action: parsed.action, issues: parsed.issues });
      sendResponse({ success: false, error: `Invalid ${parsed.action} message: ${parsed.issues.join('; ')}` });
      return false;
    }

    const message = parsed.message;
    log.debug('Message received', { action: message.action });

    switch (message.action) {
      case 'EXTRACT_DATA':
        handleExtraction()
          .then(sendResponse)
          .catch((error) => {
            log.error('Extraction handler error', { error: describeError(error) });
            sendResponse({ success: false, error: describeError(error) });
          });
        return true;

      case 'TOGGLE_AUTO_EXTRACT':
        if (message.enabled) startAutoExtract();
        else stopAutoExtract();
        sendResponse({ success: true, data: { enabled: message.enabled } });
        return false;

      case 'TOGGLE_RPC_SYNC':
        if (message.enabled) startRpcSync();
        else stopRpcSync();
        sendResponse({ success: true, data: { enabled: message.enabled } });
        return false;
    }
  },
);
