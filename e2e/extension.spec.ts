import type { Page, Worker } from '@playwright/test';
import { expect, test } from './fixtures';

interface Stored {
  contacts: { id: string; name: string; email: string; country: string }[];
  opportunities: { id: string; name: string; stage: string; revenue: number; probability: number }[];
  activities: { summary: string; type: string; dueDate: string; status: string }[];
}

const stored = (serviceWorker: Worker) =>
  serviceWorker.evaluate(async () => (await chrome.storage.local.get('odoo_data')).odoo_data as Stored);

/** Open a saved Odoo page, ask its content script to extract, and return the reply. */
async function extractFrom(page: Page, serviceWorker: Worker, url: string) {
  await page.goto(url);
  await expect(page.locator('.o_web_client')).toBeVisible();
  // The content script loads at document_start; give Odoo's markup the same settle time a user would.
  await page.waitForTimeout(500);
  return serviceWorker.evaluate(async (pageUrl) => {
    const [tab] = await chrome.tabs.query({ url: pageUrl });
    return chrome.tabs.sendMessage(tab.id!, { action: 'EXTRACT_DATA' });
  }, url);
}

test.describe('extraction from the saved Odoo pages', () => {
  for (const view of ['contact-list', 'contacts-kanban']) {
    test(`stores the contacts from ${view}`, async ({ extension, odoo }) => {
      const page = await extension.context.newPage();
      const reply = await extractFrom(page, extension.serviceWorker, `${odoo.origin}/contacts/${view}.html`);

      expect(reply).toEqual({ success: true, data: { recordsExtracted: 2 } });
      const { contacts } = await stored(extension.serviceWorker);
      expect(contacts.map(({ id, name, email, country }) => ({ id, name, email, country }))).toEqual([
        { id: 'contact_3', name: 'Demo User', email: 'demo.user@example.com', country: '' },
        { id: 'contact_1', name: 'swades-connect', email: 'demo.user@example.com', country: 'India' },
      ]);
    });
  }

  for (const view of ['leads-list', 'leads-kanban']) {
    test(`stores the opportunity from ${view}`, async ({ extension, odoo }) => {
      const page = await extension.context.newPage();
      const reply = await extractFrom(page, extension.serviceWorker, `${odoo.origin}/leads/${view}.html`);

      expect(reply).toEqual({ success: true, data: { recordsExtracted: 1 } });
      const { opportunities } = await stored(extension.serviceWorker);
      expect(opportunities).toEqual([
        expect.objectContaining({ name: "swades-connect's opportunity", stage: 'New', revenue: 0, probability: 0 }),
      ]);
    });
  }

  for (const view of ['activities-list', 'activities-kanban']) {
    test(`stores the activity from ${view}`, async ({ extension, odoo }) => {
      const page = await extension.context.newPage();
      const reply = await extractFrom(page, extension.serviceWorker, `${odoo.origin}/activities/${view}.html`);

      expect(reply).toEqual({ success: true, data: { recordsExtracted: 1 } });
      const { activities } = await stored(extension.serviceWorker);
      expect(activities).toEqual([
        expect.objectContaining({ summary: 'To-Do', type: 'todo', dueDate: '2026-01-20', status: 'open' }),
      ]);
    });
  }
});

test.describe('Odoo page console', () => {
  test('stays quiet at the default levels while the RPC interceptor installs and runs', async ({ extension, odoo }) => {
    const page = await extension.context.newPage();
    const lines: string[] = [];
    page.on('console', (message) => {
      if (message.text().includes('[Odoo RPC Interceptor]')) lines.push(`${message.type()}: ${message.text()}`);
    });

    await page.goto(`${odoo.origin}/leads/leads-list.html`);
    await expect.poll(() => lines.length).toBeGreaterThan(0);

    // Chrome hides debug ("Verbose") messages by default; anything louder lands in the user's Odoo console.
    expect(lines.filter((line) => !line.startsWith('debug:'))).toEqual([]);
  });
});

test.describe('popup', () => {
  test('lists what was extracted and deletes a contact', async ({ extension, odoo }) => {
    const odooPage = await extension.context.newPage();
    await extractFrom(odooPage, extension.serviceWorker, `${odoo.origin}/contacts/contact-list.html`);

    const popup = await extension.context.newPage();
    popup.on('dialog', (dialog) => dialog.accept());
    await popup.goto(`chrome-extension://${extension.id}/src/popup/index.html`);

    await expect(popup.getByText('2 results')).toBeVisible();
    await expect(popup.getByRole('cell', { name: 'Demo User' })).toBeVisible();
    // Inter at 14px, not the 12px system-ui Chrome applies to extension pages by default.
    expect(await popup.evaluate(() => getComputedStyle(document.body).fontSize)).toBe('14px');

    await popup
      .getByRole('row', { name: /Demo User/ })
      .getByTitle('Delete this record')
      .click();

    await expect(popup.getByText('Deleted successfully')).toBeVisible();
    await expect(popup.getByText('1 result', { exact: true })).toBeVisible();
    expect((await stored(extension.serviceWorker)).contacts.map((contact) => contact.id)).toEqual(['contact_1']);
  });

  test('saves a sync switch from the Settings modal', async ({ extension }) => {
    const popup = await extension.context.newPage();
    await popup.goto(`chrome-extension://${extension.id}/src/popup/index.html`);

    await popup.getByTitle('Settings').click();
    const autoExtract = popup.getByRole('switch', { name: 'Auto-Extract' });
    await expect(autoExtract).toHaveAttribute('aria-checked', 'false');
    await autoExtract.click();

    await expect(autoExtract).toHaveAttribute('aria-checked', 'true');
    await expect
      .poll(() => extension.serviceWorker.evaluate(() => chrome.storage.local.get('auto_extract_enabled')))
      .toEqual({ auto_extract_enabled: true });
    await popup.keyboard.press('Escape');
    await expect(popup.getByRole('dialog')).toHaveCount(0);
  });
});
