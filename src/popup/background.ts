import { BackgroundRequestError } from '../shared/errors';
import { createLogger, describeError } from '../shared/logger';
import type { DataType } from '../shared/messages';
import {
  messageResponseSchema,
  storageUpdatedMessageSchema,
  storedDataSchema,
  type BackgroundMessage,
  type StoredData,
} from '../shared/schemas';

const log = createLogger('popup');

/**
 * Send one message to the service worker and return the `data` of its reply.
 *
 * Throws BackgroundRequestError when the message cannot be delivered, when no reply comes back,
 * or when the reply reports success: false. `fallbackError` is the message used when the reply carries none.
 */
async function request(message: BackgroundMessage, fallbackError: string): Promise<unknown> {
  let raw: unknown;
  try {
    raw = await chrome.runtime.sendMessage(message);
  } catch (error) {
    throw new BackgroundRequestError(describeError(error), message.action);
  }

  const reply = messageResponseSchema.safeParse(raw);
  if (!reply.success) {
    log.warn('Service worker reply was not a MessageResponse', { action: message.action });
    throw new BackgroundRequestError(fallbackError, message.action);
  }
  if (!reply.data.success) {
    throw new BackgroundRequestError(reply.data.error || fallbackError, message.action);
  }
  return reply.data.data;
}

function parseStoredData(data: unknown, action: string): StoredData {
  const parsed = storedDataSchema.safeParse(data);
  if (!parsed.success) {
    log.warn('Stored data reply did not match the schema', { action, issues: parsed.error.issues.length });
    throw new BackgroundRequestError('Stored data came back in an unexpected shape', action);
  }
  return parsed.data;
}

/** Every stored record and the last sync time. */
export async function fetchStoredData(): Promise<StoredData> {
  return parseStoredData(await request({ action: 'GET_DATA' }, 'Failed to fetch data'), 'GET_DATA');
}

/** Delete one stored record. */
export async function deleteStoredRecord(type: DataType, id: string): Promise<void> {
  await request({ action: 'DELETE_RECORD', data: { type, id } }, 'Failed to delete record');
}

/** Delete every stored record of one type. */
export async function deleteAllStoredRecords(type: DataType): Promise<void> {
  await request({ action: 'DELETE_ALL_RECORDS', data: { type } }, 'Failed to delete all records');
}

/** Ask the active tab, through the service worker, to extract what it shows. Resolves to the number of records stored. */
export async function requestExtraction(): Promise<number> {
  const data = await request({ action: 'EXTRACT_DATA' }, 'Unknown error');
  const count = (data as { recordsExtracted?: unknown } | undefined)?.recordsExtracted;
  return typeof count === 'number' ? count : 0;
}

/** The stored data from a STORAGE_UPDATED broadcast, or null for any other message or a malformed one. */
export function parseStorageUpdate(message: unknown): StoredData | null {
  const parsed = storageUpdatedMessageSchema.safeParse(message);
  return parsed.success ? parsed.data.data : null;
}
