/**
 * Real-time sync from intercepted Odoo RPC calls.
 *
 * public/rpc-interceptor.js runs in the page and posts every relevant
 * call_kw / call_button response to the content script. This module turns
 * those signals into ODOO_RPC_UPSERT and ODOO_RPC_DELETE messages for the
 * service worker, and keeps the ID caches the DOM extractors rely on warm.
 */

import { setIndicatorState } from '../injected/indicator';
import { setupRpcSignalListener, type OdooRpcSignal } from '../injected/rpcInterceptor';
import type { DataType } from '../shared/messages';
import { createLogger, describeError } from '../shared/logger';
import {
  populateActivityIdCache,
  populateOpportunityIdCache,
  setActivityId,
  setOpportunityId,
} from './idCache';
import {
  convertRecord,
  ID_PREFIX,
  mapModelToDataType,
  recordsFromReadGroup,
  recordsFromSave,
  recordsFromSearchRead,
  type ExtensionRecord,
  type OdooRecord,
} from './odooRecords';

const log = createLogger('rpc');

let rpcSyncEnabled = false;
let rpcCleanupFn: (() => void) | null = null;

export function isRpcSyncEnabled(): boolean {
  return rpcSyncEnabled;
}

function idleState(): void {
  setIndicatorState('idle', rpcSyncEnabled ? 'RPC sync ON' : 'Ready');
}

function convertAll(dataType: DataType, records: OdooRecord[]): ExtensionRecord[] {
  const converted: ExtensionRecord[] = [];
  for (const record of records) {
    try {
      converted.push(convertRecord(dataType, record));
    } catch (error) {
      log.error('Could not convert RPC record', { dataType, error: describeError(error), record });
    }
  }
  return converted;
}

/** Remember real Odoo ids so later DOM extractions can use them instead of content hashes. */
function rememberIds(dataType: DataType, records: OdooRecord[]): void {
  for (const record of records) {
    if (typeof record.id !== 'number') continue;
    if (dataType === 'opportunities' && typeof record.name === 'string') {
      setOpportunityId(record.name, record.id);
    }
    if (dataType === 'activities' && typeof record.summary === 'string') {
      setActivityId(record.summary, record.id);
    }
  }
}

function sendUpsert(dataType: DataType, records: ExtensionRecord[]): Promise<unknown> {
  return chrome.runtime.sendMessage({ action: 'ODOO_RPC_UPSERT', data: { type: dataType, records } });
}

/** Upsert everything a list or kanban load returned, without touching the indicator on success. */
function upsertLoadedRecords(dataType: DataType, method: string, records: OdooRecord[]): void {
  if (records.length === 0) return;

  if (dataType === 'opportunities') populateOpportunityIdCache(records);
  if (dataType === 'activities') populateActivityIdCache(records);

  const converted = convertAll(dataType, records);
  if (converted.length === 0) return;

  sendUpsert(dataType, converted).catch((error) => {
    log.error(`Failed to upsert ${dataType} from ${method}`, { error: describeError(error) });
  });
}

/** Handle one RPC signal from the page interceptor. */
export function handleRpcSignal(signal: OdooRpcSignal): void {
  const { model, method, args, result } = signal.payload;
  log.debug(`RPC signal ${model}.${method}`, { args, result });

  const dataType = mapModelToDataType(model);
  if (!dataType) {
    log.warn('Ignoring RPC signal for an unknown model', { model, method });
    return;
  }

  setIndicatorState('extracting', 'Syncing...');

  try {
    switch (method) {
      case 'web_search_read': {
        // List views load through web_search_read: { length, records: [...] }.
        // The activity wizard model has no list of its own, so its reads are ignored.
        if (model !== 'mail.activity.schedule') {
          upsertLoadedRecords(dataType, method, recordsFromSearchRead(result));
        }
        idleState();
        return;
      }

      case 'web_read_group': {
        // Grouped kanban views (opportunities by stage) load through web_read_group.
        if (dataType === 'opportunities') {
          upsertLoadedRecords(dataType, method, recordsFromReadGroup(result));
        }
        idleState();
        return;
      }

      case 'unlink':
      case 'action_done': {
        // Both carry the affected ids in args[0]; marking an activity done removes it from the open list.
        const rawIds = Array.isArray(args[0]) ? args[0] : [];
        const ids = rawIds.map((id) => `${ID_PREFIX[dataType]}${id}`);
        log.info(`Removing ${dataType} after ${method}`, { ids });

        chrome.runtime
          .sendMessage({ action: 'ODOO_RPC_DELETE', data: { type: dataType, ids } })
          .then(() => setIndicatorState('success', method === 'action_done' ? 'Marked Done' : 'Deleted'))
          .catch((error) => {
            log.error('RPC delete message failed', { error: describeError(error) });
            setIndicatorState('error', 'Sync failed');
          });
        return;
      }

      case 'name_create': {
        // Quick contact creation from a Many2one field: args[0] is the name, result is [id, display_name].
        if (model !== 'res.partner') {
          log.debug('name_create is only synced for contacts', { model });
          setIndicatorState('idle', 'Ready');
          return;
        }
        if (!Array.isArray(result) || result.length < 2) {
          log.warn('Unexpected name_create result', { result });
          setIndicatorState('idle', 'Ready');
          return;
        }

        const [id, displayName] = result as [number, string];
        const name = typeof args[0] === 'string' ? args[0] : displayName;
        const contact = convertRecord('contacts', { id, name });
        log.info('Contact created through name_create', { id: contact.id });

        sendUpsert('contacts', [contact])
          .then(() => setIndicatorState('success', 'Contact Created'))
          .catch((error) => {
            log.error('RPC upsert message failed', { error: describeError(error) });
            setIndicatorState('error', 'Sync failed');
          });
        return;
      }

      case 'create':
      case 'web_save': {
        // The activity wizard returns its own id, not the mail.activity id, which would
        // create a duplicate. The web_search_read that follows brings the real record.
        if (model === 'mail.activity.schedule') {
          log.debug('Skipping mail.activity.schedule; the real id arrives with web_search_read');
          setIndicatorState('success', 'Activity Created');
          return;
        }

        const isAddition = Array.isArray(args[0]) && args[0].length === 0;
        const raw = recordsFromSave(args, result);
        rememberIds(dataType, raw);
        const records = convertAll(dataType, raw);

        if (records.length === 0) {
          setIndicatorState('idle', 'Ready');
          return;
        }

        log.info(`RPC ${isAddition ? 'create' : 'update'} of ${records.length} ${dataType}`);
        sendUpsert(dataType, records)
          .then(() => setIndicatorState('success', isAddition ? 'Added' : 'Synced'))
          .catch((error) => {
            log.error('RPC upsert message failed', { error: describeError(error) });
            setIndicatorState('error', 'Sync failed');
          });
        return;
      }

      case 'write': {
        // write returns true; the full record follows in a web_save, which is synced instead.
        log.debug('write seen, waiting for web_save');
        setIndicatorState('idle', 'Ready');
        return;
      }

      default:
        log.debug('Unhandled RPC method', { method });
        setIndicatorState('idle', 'Ready');
    }
  } catch (error) {
    log.error('Error handling RPC signal', { model, method, error: describeError(error) });
    setIndicatorState('error', 'Sync error');
  }
}

/** Start listening for RPC signals and persist the setting. */
export function startRpcSync(): void {
  if (rpcSyncEnabled) {
    log.debug('RPC sync already active');
    return;
  }

  rpcCleanupFn = setupRpcSignalListener(handleRpcSignal);
  rpcSyncEnabled = true;
  log.info('RPC sync started');

  chrome.storage.local.set({ rpc_sync_enabled: true });
  chrome.runtime.sendMessage({ action: 'UPDATE_BADGE', data: { text: 'RPC' } });
  setIndicatorState('idle', 'RPC sync ON');
}

/** Stop listening for RPC signals and persist the setting. */
export function stopRpcSync(): void {
  if (!rpcSyncEnabled) {
    log.debug('RPC sync not active');
    return;
  }

  rpcCleanupFn?.();
  rpcCleanupFn = null;
  rpcSyncEnabled = false;
  log.info('RPC sync stopped');

  chrome.storage.local.set({ rpc_sync_enabled: false });
  chrome.runtime.sendMessage({ action: 'UPDATE_BADGE', data: { text: '' } });
  setIndicatorState('idle', 'Ready');
}
