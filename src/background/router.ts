import { createLogger } from '../shared/logger';
import type { MessageResponse } from '../shared/messages';
import { parseBackgroundMessage } from '../shared/schemas';
import { handleDeleteAllRecords, handleDeleteRecord, handleGetData, handleSaveData, handleUpdateBadge } from './handlers/data';
import { handleExtractionComplete, handleExtractionError, handleExtractRequest } from './handlers/extract';
import { handleRpcDelete, handleRpcUpsert } from './handlers/rpc';

const log = createLogger('background');

/**
 * Validate a runtime message and dispatch it to its handler.
 * Malformed messages are rejected here, so handlers receive typed data.
 */
export async function routeMessage(raw: unknown, sender: chrome.runtime.MessageSender): Promise<MessageResponse> {
  const parsed = parseBackgroundMessage(raw);

  if (!parsed.ok) {
    if (parsed.reason === 'unknown-action') {
      log.warn('Unknown message action', { action: parsed.action });
      return { success: false, error: 'Unknown action' };
    }
    log.warn('Rejected malformed message', { action: parsed.action, issues: parsed.issues });
    return { success: false, error: `Invalid ${parsed.action} message: ${parsed.issues.join('; ')}` };
  }

  const message = parsed.message;
  log.debug('Message received', { action: message.action, from: sender.url ?? 'popup/internal' });

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
      return { success: true, data: { message: 'Service worker is alive' } };
  }
}
