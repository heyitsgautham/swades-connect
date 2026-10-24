import { acquireLock, releaseLock } from '../../shared/lock';
import { createLogger, describeError } from '../../shared/logger';
import type { MessageResponse } from '../../shared/messages';
import type { BackgroundMessage } from '../../shared/schemas';
import { deleteAllRecords, deleteRecord, getData, saveData } from '../../shared/storage';
import { broadcastStorageUpdate } from '../broadcast';

const log = createLogger('background');

type Of<A extends BackgroundMessage['action']> = Extract<BackgroundMessage, { action: A }>;

function failure(context: string, error: unknown): MessageResponse {
  const errorMessage = describeError(error);
  log.error(context, { error: errorMessage });
  return { success: false, error: errorMessage };
}

export async function handleGetData(): Promise<MessageResponse> {
  try {
    return { success: true, data: await getData() };
  } catch (error) {
    return failure('Error retrieving data', error);
  }
}

export async function handleSaveData(message: Of<'SAVE_DATA'>): Promise<MessageResponse> {
  const lockId = `save_${Date.now()}`;

  try {
    if (!(await acquireLock(lockId))) {
      return { success: false, error: 'Could not acquire lock' };
    }

    const { contacts = [], opportunities = [], activities = [] } = message.data;
    await saveData(contacts, opportunities, activities);
    void broadcastStorageUpdate();
    return { success: true };
  } catch (error) {
    return failure('Error saving data', error);
  } finally {
    await releaseLock(lockId);
  }
}

export async function handleDeleteRecord(message: Of<'DELETE_RECORD'>): Promise<MessageResponse> {
  try {
    await deleteRecord(message.data.type, message.data.id);
    void broadcastStorageUpdate();
    return { success: true };
  } catch (error) {
    return failure('Error deleting record', error);
  }
}

export async function handleDeleteAllRecords(message: Of<'DELETE_ALL_RECORDS'>): Promise<MessageResponse> {
  try {
    await deleteAllRecords(message.data.type);
    void broadcastStorageUpdate();
    log.info('Deleted all records', { type: message.data.type });
    return { success: true };
  } catch (error) {
    return failure('Error deleting all records', error);
  }
}

export async function handleUpdateBadge(message: Of<'UPDATE_BADGE'>): Promise<MessageResponse> {
  try {
    const { text } = message.data;
    await chrome.action.setBadgeText({ text });
    if (text) {
      await chrome.action.setBadgeBackgroundColor({ color: '#16a34a' });
    }
    log.debug('Badge updated', { text });
    return { success: true };
  } catch (error) {
    return failure('Error updating badge', error);
  }
}
