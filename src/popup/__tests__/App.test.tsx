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
});
