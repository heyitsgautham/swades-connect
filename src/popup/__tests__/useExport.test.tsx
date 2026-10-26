import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ContactsTab from '../components/ContactsTab';
import { ToastProvider } from '../components/Toast';
import { makeContact } from '../../test/fixtures';

// jsdom's Blob has no text(), so read it the way a page would have before that existed.
const readText = (blob: Blob) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsText(blob);
  });

describe('exporting from a tab', () => {
  it('downloads every record as CSV and confirms with a toast', async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn((blob: Blob) => {
      void blob;
      return 'blob:swades-test';
    });
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const contacts = [makeContact({ id: 'c1' }), makeContact({ id: 'c2', name: 'Bea Sample' })];

    render(
      <ToastProvider>
        <ContactsTab contacts={contacts} onDelete={vi.fn()} onDeleteAll={vi.fn()} />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('button', { name: /CSV/ }));

    expect(click).toHaveBeenCalledOnce();
    const anchor = click.mock.contexts[0] as HTMLAnchorElement;
    expect(anchor.download).toMatch(/^swades-contacts-\d+\.csv$/);
    const blob = createObjectURL.mock.calls[0][0];
    expect(blob.type).toBe('text/csv');
    expect(await readText(blob)).toContain('Bea Sample');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:swades-test');
    expect(screen.getByText('Exported 2 contacts as CSV')).toBeTruthy();
  });
});
