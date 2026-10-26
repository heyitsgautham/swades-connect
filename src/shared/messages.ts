/**
 * Message contracts between the popup, content script and service worker.
 *
 * The request shapes live in schemas.ts as zod schemas, so each one is
 * checked at runtime where it is received; the types here are inferred from them.
 */

import type { z } from 'zod';
import type { storageUpdatedMessageSchema } from './schemas';

export type { BackgroundMessage, ContentMessage, DataType, StoredData } from './schemas';

/** Every reply sent through sendResponse. */
export interface MessageResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

/** Broadcast from the service worker to open popups after stored data changes. */
export type StorageUpdatedMessage = z.infer<typeof storageUpdatedMessageSchema>;
