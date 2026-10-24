/**
 * Content script entry point, injected at document_start on Odoo pages.
 *
 * It injects the page-level RPC interceptor before Odoo loads data, mounts
 * the status indicator, restores the auto-extract and RPC sync settings, and
 * answers EXTRACT_DATA, TOGGLE_AUTO_EXTRACT and TOGGLE_RPC_SYNC messages.
 */

import { mountIndicator } from '../injected/indicator';
import { injectRpcInterceptor } from '../injected/rpcInterceptor';
import { createLogger, describeError, initLogLevelFromStorage } from '../shared/logger';
import type { ExtensionMessage, MessageResponse } from '../shared/messages';
import { handleExtraction, startAutoExtract, stopAutoExtract } from './extraction';
import { startRpcSync, stopRpcSync } from './rpcSync';

const log = createLogger('content');

void initLogLevelFromStorage();
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
  (message: ExtensionMessage, _sender, sendResponse: (response: MessageResponse) => void): boolean => {
    log.debug('Message received', { action: message.action });

    if (message.action === 'EXTRACT_DATA') {
      handleExtraction()
        .then(sendResponse)
        .catch((error) => {
          log.error('Extraction handler error', { error: describeError(error) });
          sendResponse({ success: false, error: describeError(error) });
        });
      return true;
    }

    if (message.action === 'TOGGLE_AUTO_EXTRACT') {
      const enabled = Boolean((message as unknown as { enabled?: boolean }).enabled);
      if (enabled) startAutoExtract();
      else stopAutoExtract();
      sendResponse({ success: true, data: { enabled } });
      return true;
    }

    if (message.action === 'TOGGLE_RPC_SYNC') {
      const enabled = Boolean((message as unknown as { enabled?: boolean }).enabled);
      if (enabled) startRpcSync();
      else stopRpcSync();
      sendResponse({ success: true, data: { enabled } });
      return true;
    }

    return false;
  },
);
