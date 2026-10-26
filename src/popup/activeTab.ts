import type { ContentMessage } from '../shared/messages';
import { createLogger, describeError } from '../shared/logger';

const log = createLogger('popup');

/**
 * Send a message to the content script in the active tab.
 *
 * Resolves to false instead of rejecting when there is no active tab, or when the tab has no
 * content script listening, which is the case on any page that is not Odoo.
 * Callers save the preference first; the content script reads it on its next load.
 */
export async function notifyActiveTab(message: ContentMessage): Promise<boolean> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined) return false;
    await chrome.tabs.sendMessage(tab.id, message);
    return true;
  } catch (error) {
    log.debug('Active tab did not take the message', { action: message.action, error: describeError(error) });
    return false;
  }
}
