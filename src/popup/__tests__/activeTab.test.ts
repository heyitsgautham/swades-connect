import { describe, expect, it } from 'vitest';
import { notifyActiveTab } from '../activeTab';
import { chromeMock } from '../../test/chromeMock';

const message = { action: 'TOGGLE_RPC_SYNC', enabled: true } as const;

describe('notifyActiveTab', () => {
  it('sends the message to the active tab', async () => {
    const chrome = chromeMock();
    chrome.tabs.query.mockResolvedValue([{ id: 9 } as chrome.tabs.Tab]);

    await expect(notifyActiveTab(message)).resolves.toBe(true);
    expect(chrome.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true });
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(9, message);
  });

  it('resolves false when the tab has no content script listening', async () => {
    const chrome = chromeMock();
    chrome.tabs.query.mockResolvedValue([{ id: 9 } as chrome.tabs.Tab]);
    chrome.tabs.sendMessage.mockRejectedValue(
      new Error('Could not establish connection. Receiving end does not exist.'),
    );

    await expect(notifyActiveTab(message)).resolves.toBe(false);
  });

  it('resolves false without sending when there is no active tab', async () => {
    const chrome = chromeMock();
    chrome.tabs.query.mockResolvedValue([]);

    await expect(notifyActiveTab(message)).resolves.toBe(false);
    expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
  });
});
