import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Settings from '../components/Settings';
import { chromeMock } from '../../test/chromeMock';

const ACTIVE_TAB = { id: 42 } as chrome.tabs.Tab;

const toggles = () => ({
  rpcSync: screen.getByRole('switch', { name: 'Real-time Sync' }),
  autoExtract: screen.getByRole('switch', { name: 'Auto-Extract' }),
});

function renderSettings({
  tabs = [ACTIVE_TAB],
  stored = {},
}: { tabs?: chrome.tabs.Tab[]; stored?: Record<string, unknown> } = {}) {
  const chrome = chromeMock();
  chrome.tabs.query.mockResolvedValue(tabs);
  void chrome.storage.local.set(stored);
  chrome.storage.local.set.mockClear();
  const onClose = vi.fn();
  render(<Settings onClose={onClose} />);
  return { chrome, onClose };
}

describe('Settings', () => {
  it('is a labelled dialog whose switches report their state', async () => {
    renderSettings({ stored: { auto_extract_enabled: true } });

    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeTruthy();
    await waitFor(() => expect(toggles().autoExtract.getAttribute('aria-checked')).toBe('true'));
    expect(toggles().rpcSync.getAttribute('aria-checked')).toBe('false');
    expect(toggles().autoExtract.getAttribute('aria-describedby')).toBeTruthy();
    expect(screen.getByText(/Monitors DOM changes/).id).toBe(toggles().autoExtract.getAttribute('aria-describedby'));
  });

  it('shows the status note for each preference already stored', async () => {
    renderSettings({ stored: { rpc_sync_enabled: true } });
    expect(await screen.findByText(/Real-time Sync is ON/)).toBeTruthy();
  });

  it('saves Auto-Extract and tells the active tab to start watching the DOM', async () => {
    const user = userEvent.setup();
    const { chrome } = renderSettings();

    await user.click(toggles().autoExtract);

    expect(chrome.storage.local.set).toHaveBeenCalledWith({ auto_extract_enabled: true });
    expect(toggles().autoExtract.getAttribute('aria-checked')).toBe('true');
    await waitFor(() =>
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(42, { action: 'TOGGLE_AUTO_EXTRACT', enabled: true }),
    );
    expect(screen.getByText(/Auto-extract is ON/)).toBeTruthy();
  });

  it('saves Real-time Sync off when it was on', async () => {
    const user = userEvent.setup();
    const { chrome } = renderSettings({ stored: { rpc_sync_enabled: true } });
    await screen.findByText(/Real-time Sync is ON/);

    await user.click(toggles().rpcSync);

    expect(chrome.storage.local.set).toHaveBeenCalledWith({ rpc_sync_enabled: false });
    await waitFor(() =>
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(42, { action: 'TOGGLE_RPC_SYNC', enabled: false }),
    );
    expect(screen.queryByText(/Real-time Sync is ON/)).toBeNull();
  });

  it('still saves the preference when the active tab has no content script', async () => {
    const user = userEvent.setup();
    const { chrome } = renderSettings();
    chrome.tabs.sendMessage.mockRejectedValue(
      new Error('Could not establish connection. Receiving end does not exist.'),
    );

    await user.click(toggles().rpcSync);

    expect(chrome.storage.local.set).toHaveBeenCalledWith({ rpc_sync_enabled: true });
    await waitFor(() => expect(chrome.tabs.sendMessage).toHaveBeenCalled());
    expect(screen.getByText(/Real-time Sync is ON/)).toBeTruthy();
  });

  it('still saves the preference when there is no active tab', async () => {
    const user = userEvent.setup();
    const { chrome } = renderSettings({ tabs: [] });

    // Before the fix this threw on `tab.id` inside the click handler, and vitest fails the run on the unhandled rejection.
    await user.click(toggles().autoExtract);
    await waitFor(() => expect(chrome.tabs.query).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(chrome.storage.local.set).toHaveBeenCalledWith({ auto_extract_enabled: true });
    expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
    expect(screen.getByText(/Auto-extract is ON/)).toBeTruthy();
  });

  it('closes from the X button', async () => {
    const user = userEvent.setup();
    const { onClose } = renderSettings();
    await user.click(screen.getByRole('button', { name: 'Close settings' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
