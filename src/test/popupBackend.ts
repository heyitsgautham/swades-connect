import type { Activity, Contact, Opportunity } from '../shared/types';
import type { DataType, MessageResponse } from '../shared/messages';
import { chromeMock } from './chromeMock';

export interface PopupData {
  contacts: Contact[];
  opportunities: Opportunity[];
  activities: Activity[];
  lastSync: number;
}

interface PopupMessage {
  action: string;
  data?: { type: DataType; id?: string };
}

type Override = (message: PopupMessage) => MessageResponse | undefined;

/**
 * Stand-in for the service worker as the popup sees it.
 * Answers GET_DATA, DELETE_RECORD, DELETE_ALL_RECORDS and EXTRACT_DATA from an in-memory copy of `seed`,
 * in both the callback and the promise form of chrome.runtime.sendMessage.
 * Replies arrive on a later task, as they do from Chrome's message channel, so React renders in between.
 * `override` can answer a message first, for failure cases; return undefined to fall through.
 */
export function installPopupBackend(seed: Partial<PopupData> = {}, override?: Override) {
  const data: PopupData = { contacts: [], opportunities: [], activities: [], lastSync: 0, ...structuredClone(seed) };
  const actions: string[] = [];

  const answer = (message: PopupMessage): MessageResponse => {
    actions.push(message.action);
    const custom = override?.(message);
    if (custom) return custom;
    switch (message.action) {
      case 'GET_DATA':
        return { success: true, data: structuredClone(data) };
      case 'DELETE_RECORD': {
        const { type, id } = message.data!;
        (data[type] as { id: string }[]) = (data[type] as { id: string }[]).filter((record) => record.id !== id);
        return { success: true };
      }
      case 'DELETE_ALL_RECORDS':
        data[message.data!.type] = [];
        return { success: true };
      case 'EXTRACT_DATA':
        return { success: true, data: { recordsExtracted: 0 } };
      default:
        return { success: false, error: `Unhandled action ${message.action}` };
    }
  };

  chromeMock().runtime.sendMessage.mockImplementation((message: unknown, callback?: (response: unknown) => void) => {
    const response = answer(message as PopupMessage);
    if (callback) {
      setTimeout(() => callback(response), 0);
      return Promise.resolve(undefined as unknown);
    }
    return new Promise<unknown>((resolve) => setTimeout(() => resolve(response), 0));
  });

  return { data, actions };
}
