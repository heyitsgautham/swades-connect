import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chromeMock } from '../../test/chromeMock';

vi.mock('../extraction', () => ({
  handleExtraction: vi.fn(async () => ({ success: true, data: { recordsExtracted: 3 } })),
  startAutoExtract: vi.fn(),
  stopAutoExtract: vi.fn(),
}));
vi.mock('../rpcSync', () => ({ startRpcSync: vi.fn(), stopRpcSync: vi.fn() }));
vi.mock('../../injected/indicator', () => ({ mountIndicator: vi.fn() }));
vi.mock('../../injected/rpcInterceptor', () => ({ injectRpcInterceptor: vi.fn() }));

type Listener = (message: unknown, sender: unknown, respond: (response: unknown) => void) => boolean;

/** Load the content script fresh, with the given preferences already stored, and return its message listener. */
async function loadContentScript(stored: Record<string, unknown> = {}) {
  vi.resetModules();
  await chromeMock().storage.local.set(stored);
  await import('../index');
  const extraction = await import('../extraction');
  const rpcSync = await import('../rpcSync');
  const { mountIndicator } = await import('../../injected/indicator');
  const { injectRpcInterceptor } = await import('../../injected/rpcInterceptor');
  const [listener] = chromeMock().runtime.onMessage.listeners as Set<Listener>;
  return { listener, extraction, rpcSync, mountIndicator, injectRpcInterceptor };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('content script entry', () => {
  it('injects the RPC interceptor and mounts the indicator as soon as it loads', async () => {
    const { injectRpcInterceptor, mountIndicator } = await loadContentScript();
    expect(injectRpcInterceptor).toHaveBeenCalledOnce();
    expect(mountIndicator).toHaveBeenCalledOnce();
  });

  it('restores the stored auto-extract and RPC sync settings', async () => {
    const { extraction, rpcSync } = await loadContentScript({ auto_extract_enabled: true, rpc_sync_enabled: true });
    expect(extraction.startAutoExtract).toHaveBeenCalledOnce();
    expect(rpcSync.startRpcSync).toHaveBeenCalledOnce();
  });

  it('starts neither mode when nothing is stored', async () => {
    const { extraction, rpcSync } = await loadContentScript();
    expect(extraction.startAutoExtract).not.toHaveBeenCalled();
    expect(rpcSync.startRpcSync).not.toHaveBeenCalled();
  });

  it('answers EXTRACT_DATA asynchronously with the extraction result', async () => {
    const { listener } = await loadContentScript();
    const respond = vi.fn();

    expect(listener({ action: 'EXTRACT_DATA' }, {}, respond)).toBe(true);

    await vi.waitFor(() => expect(respond).toHaveBeenCalledWith({ success: true, data: { recordsExtracted: 3 } }));
  });

  it('reports a failed extraction instead of leaving the popup waiting', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { listener, extraction } = await loadContentScript();
    vi.mocked(extraction.handleExtraction).mockRejectedValueOnce(new Error('pager missing'));
    const respond = vi.fn();

    listener({ action: 'EXTRACT_DATA' }, {}, respond);

    await vi.waitFor(() => expect(respond).toHaveBeenCalledWith({ success: false, error: 'pager missing' }));
  });

  it.each([
    ['TOGGLE_AUTO_EXTRACT', true, 'startAutoExtract'],
    ['TOGGLE_AUTO_EXTRACT', false, 'stopAutoExtract'],
    ['TOGGLE_RPC_SYNC', true, 'startRpcSync'],
    ['TOGGLE_RPC_SYNC', false, 'stopRpcSync'],
  ] as const)('handles %s enabled=%s with %s', async (action, enabled, handler) => {
    const loaded = await loadContentScript();
    const respond = vi.fn();

    expect(loaded.listener({ action, enabled }, {}, respond)).toBe(false);

    const handlers = { ...loaded.extraction, ...loaded.rpcSync } as Record<string, unknown>;
    expect(handlers[handler]).toHaveBeenCalledOnce();
    expect(respond).toHaveBeenCalledWith({ success: true, data: { enabled } });
  });

  it('rejects a malformed message with the validation issues', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { listener, rpcSync } = await loadContentScript();
    const respond = vi.fn();

    listener({ action: 'TOGGLE_RPC_SYNC', enabled: 'yes' }, {}, respond);

    expect(rpcSync.startRpcSync).not.toHaveBeenCalled();
    expect(respond).toHaveBeenCalledWith({
      success: false,
      error: expect.stringMatching(/^Invalid TOGGLE_RPC_SYNC message: enabled: /),
    });
  });

  it('leaves messages for other contexts unanswered', async () => {
    const { listener } = await loadContentScript();
    const respond = vi.fn();

    expect(listener({ action: 'STORAGE_UPDATED' }, {}, respond)).toBe(false);
    expect(respond).not.toHaveBeenCalled();
  });
});
