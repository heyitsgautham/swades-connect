import { vi } from 'vitest';

type Items = Record<string, unknown>;
type Keys = string | string[] | Items | null | undefined;

/**
 * In-memory stand-in for a chrome.storage area.
 * Supports both the promise form and the callback form of get/set,
 * because the content script uses callbacks and everything else uses promises.
 * Values are deep-copied on the way in and out, like the real structured-clone storage.
 */
export function createStorageArea(onChange?: (changes: Items) => void) {
  let store: Items = {};
  const clone = <T>(value: T): T => structuredClone(value);

  const pick = (keys: Keys): Items => {
    if (keys === null || keys === undefined) return clone(store);
    if (typeof keys === 'string') keys = [keys];
    if (Array.isArray(keys)) {
      const out: Items = {};
      for (const key of keys) if (key in store) out[key] = clone(store[key]);
      return out;
    }
    const out: Items = {};
    for (const [key, fallback] of Object.entries(keys)) {
      out[key] = key in store ? clone(store[key]) : fallback;
    }
    return out;
  };

  return {
    get: vi.fn((keys?: Keys, callback?: (items: Items) => void) => {
      const result = pick(keys);
      if (callback) {
        callback(result);
        return undefined;
      }
      return Promise.resolve(result);
    }),
    set: vi.fn((items: Items, callback?: () => void) => {
      const changes: Items = {};
      for (const [key, value] of Object.entries(items)) {
        changes[key] = { oldValue: store[key], newValue: clone(value) };
        store[key] = clone(value);
      }
      onChange?.(changes);
      callback?.();
      return Promise.resolve();
    }),
    remove: vi.fn((keys: string | string[]) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) delete store[key];
      return Promise.resolve();
    }),
    clear: vi.fn(() => {
      store = {};
      return Promise.resolve();
    }),
    /** Test helper: read the raw store without going through the spy. */
    dump: () => clone(store),
  };
}

function createEvent() {
  const listeners = new Set<(...args: never[]) => unknown>();
  return {
    addListener: vi.fn((fn: (...args: never[]) => unknown) => listeners.add(fn)),
    removeListener: vi.fn((fn: (...args: never[]) => unknown) => listeners.delete(fn)),
    hasListener: (fn: (...args: never[]) => unknown) => listeners.has(fn),
    listeners,
  };
}

export function createChromeMock() {
  const onChanged = createEvent();
  const local = createStorageArea();
  const session = createStorageArea();

  return {
    storage: { local, session, onChanged },
    runtime: {
      lastError: undefined as chrome.runtime.LastError | undefined,
      sendMessage: vi.fn((_message: unknown, callback?: (response: unknown) => void) => {
        callback?.(undefined);
        return Promise.resolve(undefined as unknown);
      }),
      onMessage: createEvent(),
      getURL: vi.fn((path: string) => `chrome-extension://test-extension-id/${path}`),
      setUninstallURL: vi.fn(() => Promise.resolve()),
    },
    tabs: {
      query: vi.fn(() => Promise.resolve([] as chrome.tabs.Tab[])),
      sendMessage: vi.fn(() => Promise.resolve(undefined as unknown)),
    },
    action: {
      setBadgeText: vi.fn(() => Promise.resolve()),
      setBadgeBackgroundColor: vi.fn(() => Promise.resolve()),
    },
  };
}

export type ChromeMock = ReturnType<typeof createChromeMock>;

/** Install a fresh mock on globalThis.chrome and return it. */
export function installChromeMock(): ChromeMock {
  const mock = createChromeMock();
  (globalThis as unknown as { chrome: ChromeMock }).chrome = mock;
  return mock;
}

/** The mock currently installed by the test setup file. */
export function chromeMock(): ChromeMock {
  return (globalThis as unknown as { chrome: ChromeMock }).chrome;
}
