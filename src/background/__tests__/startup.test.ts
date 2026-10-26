import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chromeMock } from '../../test/chromeMock';
import { makeContact } from '../../test/fixtures';

type Listener = (message: unknown, sender: chrome.runtime.MessageSender, respond: (r: unknown) => void) => boolean;

beforeEach(() => {
  vi.resetModules();
});

describe('service worker startup', () => {
  it('keeps a save that lands while the worker is still starting up', async () => {
    const local = chromeMock().storage.local;
    const read = local.get.getMockImplementation()!;
    // The first read of odoo_data sees the store as it is when called, but answers 50 ms later.
    // The old startup write made that read, saw the empty store, and wrote the empty default after the save.
    let held = false;
    local.get.mockImplementation((keys, callback) => {
      if (held || keys !== 'odoo_data') return read(keys, callback);
      held = true;
      const snapshot = read(keys) as Promise<Record<string, unknown>>;
      return new Promise((resolve) => setTimeout(() => resolve(snapshot), 50));
    });

    await import('../index');
    const [listener] = chromeMock().runtime.onMessage.listeners as Set<Listener>;
    const saved = await new Promise((respond) =>
      listener({ action: 'SAVE_DATA', data: { contacts: [makeContact({ id: 'first' })] } }, {}, respond),
    );
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(saved).toEqual({ success: true });
    expect((local.dump().odoo_data as { contacts: { id: string }[] }).contacts.map((c) => c.id)).toEqual(['first']);
  });
});
