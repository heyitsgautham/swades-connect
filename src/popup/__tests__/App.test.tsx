import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { ToastProvider } from '../components/Toast';
import { makeContact } from '../../test/fixtures';
import { installPopupBackend } from '../../test/popupBackend';

const contacts = [
  makeContact({ id: 'c1', name: 'Alex Example', email: 'alex@example.com', company: 'Acme Corp' }),
  makeContact({ id: 'c2', name: 'Bea Sample', email: 'bea@example.com', company: 'Globex' }),
  makeContact({ id: 'c3', name: 'Cal Demo', email: 'cal@example.com', company: 'Acme Corp' }),
];

function renderPopup() {
  return render(
    <ToastProvider>
      <App />
    </ToastProvider>,
  );
}

const rowNames = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0].textContent);

beforeEach(() => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('App', () => {
  it('shows the stored contacts once GET_DATA answers', async () => {
    installPopupBackend({ contacts });
    renderPopup();

    expect(screen.getByText('Loading data...')).toBeTruthy();
    expect(await screen.findByText('3 results')).toBeTruthy();
    expect(rowNames()).toEqual(['Alex Example', 'Bea Sample', 'Cal Demo']);
  });

  it('shows the storage error when GET_DATA fails', async () => {
    installPopupBackend({}, (message) =>
      message.action === 'GET_DATA' ? { success: false, error: 'Storage is unavailable' } : undefined,
    );
    renderPopup();

    expect(await screen.findByText('Storage is unavailable')).toBeTruthy();
  });

  it('keeps the search filter after a row is deleted', async () => {
    const user = userEvent.setup();
    installPopupBackend({ contacts });
    renderPopup();
    await screen.findByText('3 results');

    await user.type(screen.getByPlaceholderText(/Search by name/), 'acme');
    expect(rowNames()).toEqual(['Alex Example', 'Cal Demo']);

    await user.click(screen.getAllByTitle('Delete this record')[0]);

    expect(await screen.findByText('Deleted successfully')).toBeTruthy();
    await waitFor(() => expect(rowNames()).toEqual(['Cal Demo']));
    expect(screen.getByPlaceholderText<HTMLInputElement>(/Search by name/).value).toBe('acme');
    expect(screen.queryByText('Loading data...')).toBeNull();
  });

  it('restores the row and shows an error toast when the delete fails', async () => {
    const user = userEvent.setup();
    installPopupBackend({ contacts }, (message) =>
      message.action === 'DELETE_RECORD' ? { success: false, error: 'Delete failed' } : undefined,
    );
    renderPopup();
    await screen.findByText('3 results');

    await user.click(screen.getAllByTitle('Delete this record')[1]);

    expect(await screen.findByText('Failed to delete. Restored item.')).toBeTruthy();
    expect(rowNames()).toEqual(['Alex Example', 'Bea Sample', 'Cal Demo']);
  });

  it('deletes every contact after the user confirms Delete All', async () => {
    const user = userEvent.setup();
    const backend = installPopupBackend({ contacts });
    renderPopup();
    await screen.findByText('3 results');

    await user.click(screen.getByRole('button', { name: /Delete All/ }));

    expect(window.confirm).toHaveBeenCalledWith(
      'Are you sure you want to delete all 3 contacts? This cannot be undone.',
    );
    expect(await screen.findByText('Deleted all 3 contacts')).toBeTruthy();
    expect(backend.data.contacts).toEqual([]);
    expect(await screen.findByText('No contacts found')).toBeTruthy();
  });

  it('leaves the records alone when the user cancels Delete All', async () => {
    const user = userEvent.setup();
    vi.mocked(window.confirm).mockReturnValue(false);
    const backend = installPopupBackend({ contacts });
    renderPopup();
    await screen.findByText('3 results');

    await user.click(screen.getByRole('button', { name: /Delete All/ }));

    expect(backend.actions).not.toContain('DELETE_ALL_RECORDS');
    expect(rowNames()).toHaveLength(3);
  });

  it('reports how many records an extraction stored', async () => {
    const user = userEvent.setup();
    chrome.tabs.query = vi.fn(() => Promise.resolve([{ id: 7 } as chrome.tabs.Tab]));
    installPopupBackend({ contacts }, (message) =>
      message.action === 'EXTRACT_DATA' ? { success: true, data: { recordsExtracted: 11 } } : undefined,
    );
    renderPopup();
    await screen.findByText('3 results');

    await user.click(screen.getByRole('button', { name: /Extract Now/ }));

    expect(await screen.findByText('Extracted 11 records')).toBeTruthy();
  });

  it('switches tabs and clears the last extraction message', async () => {
    const user = userEvent.setup();
    installPopupBackend({ contacts }, (message) =>
      message.action === 'EXTRACT_DATA' ? { success: false, error: 'Not an Odoo page' } : undefined,
    );
    chrome.tabs.query = vi.fn(() => Promise.resolve([{ id: 7 } as chrome.tabs.Tab]));
    renderPopup();
    await screen.findByText('3 results');

    await user.click(screen.getByRole('button', { name: /Extract Now/ }));
    expect(await screen.findByText('Not an Odoo page')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Opportunities/ }));

    expect(screen.queryByText('Not an Odoo page')).toBeNull();
    expect(screen.getByText('No opportunities found')).toBeTruthy();
  });
});
