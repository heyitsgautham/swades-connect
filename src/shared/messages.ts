/**
 * Message contracts between the popup, content script and service worker.
 *
 * The request shapes live in schemas.ts as zod schemas, so each one is
 * checked at runtime where it is received; the types here are inferred from them.
 */

import type { Activity, Contact, Opportunity } from './types';

export type { BackgroundMessage, ContentMessage } from './schemas';

/** Record collection a message refers to. */
export type DataType = 'contacts' | 'opportunities' | 'activities';

/** Every reply sent through sendResponse. */
export interface MessageResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

/** Broadcast from the service worker to open popups after stored data changes. */
export interface StorageUpdatedMessage {
  action: 'STORAGE_UPDATED';
  data: {
    contacts: Contact[];
    opportunities: Opportunity[];
    activities: Activity[];
    lastSync: number;
  };
}
