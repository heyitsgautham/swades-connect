import { createLogger, describeError } from '../../shared/logger';
import type { MessageResponse } from '../../shared/messages';
import type { BackgroundMessage } from '../../shared/schemas';
import { deleteRecordsById, upsertRecords, upsertUpgradingHashIds } from '../../shared/storage';
import { broadcastStorageUpdate } from '../broadcast';

const log = createLogger('rpc');

type Of<A extends BackgroundMessage['action']> = Extract<BackgroundMessage, { action: A }>;

/**
 * Store records captured from Odoo RPC traffic. Opportunities and activities
 * may already be stored under a content-hash id from DOM extraction, so they
 * go through upsertUpgradingHashIds, which swaps in the real Odoo id.
 */
export async function handleRpcUpsert(message: Of<'ODOO_RPC_UPSERT'>): Promise<MessageResponse> {
  const { type, records } = message.data;

  try {
    const result =
      type === 'contacts' ? await upsertRecords(type, records) : await upsertUpgradingHashIds(type, records);

    log.info('Upserted records from RPC', { type, ...result });
    await broadcastStorageUpdate();
    return { success: true, data: result };
  } catch (error) {
    const errorMessage = describeError(error);
    log.error('Error in RPC upsert', { type, error: errorMessage });
    return { success: false, error: errorMessage };
  }
}

/**
 * Remove records deleted in Odoo.
 *
 * Known limitation: a record that was DOM-extracted under a hash id and then
 * deleted in Odoo before any RPC edit upgraded its id cannot be matched, because
 * the delete only carries the real id. Re-extracting the page cleans it up.
 */
export async function handleRpcDelete(message: Of<'ODOO_RPC_DELETE'>): Promise<MessageResponse> {
  const { type, ids } = message.data;

  try {
    const deleted = await deleteRecordsById(type, ids);

    if (deleted === 0) {
      log.warn(
        'No stored records matched an RPC delete; they may be stored under hash ids. Re-extract the page to clean up.',
        {
          type,
          ids,
        },
      );
    } else if (deleted < ids.length) {
      log.warn('Partial RPC delete; some records may be stored under hash ids', {
        type,
        deleted,
        requested: ids.length,
      });
    } else {
      log.info('Deleted records from RPC', { type, deleted });
    }

    await broadcastStorageUpdate();
    return { success: true, data: { deleted } };
  } catch (error) {
    const errorMessage = describeError(error);
    log.error('Error in RPC delete', { type, error: errorMessage });
    return { success: false, error: errorMessage };
  }
}
