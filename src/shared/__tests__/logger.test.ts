import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLogger, describeError, getLogLevel, initLogLevelFromStorage, isLogLevel, setLogLevel } from '../logger';
import { chromeMock } from '../../test/chromeMock';

describe('logger', () => {
  beforeEach(() => {
    setLogLevel('info');
  });
  afterEach(() => {
    setLogLevel('info');
  });

  it('prefixes the scope and passes context as a separate argument', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    createLogger('storage').info('saved', { contacts: 3 });
    expect(info).toHaveBeenCalledWith('[Swades Connect:storage] saved', { contacts: 3 });
  });

  it('omits the context argument when none is given', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    createLogger('rpc').warn('odd payload');
    expect(warn).toHaveBeenCalledWith('[Swades Connect:rpc] odd payload');
  });

  it('drops messages below the minimum level', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    setLogLevel('error');
    const log = createLogger('x');
    log.debug('hidden');
    log.error('shown');
    expect(debug).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledOnce();
  });

  it('shows debug lines once the level is lowered', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    setLogLevel('debug');
    createLogger('x').debug('trace');
    expect(debug).toHaveBeenCalledOnce();
  });

  it('recognises only the four level names', () => {
    expect(isLogLevel('warn')).toBe(true);
    expect(isLogLevel('verbose')).toBe(false);
    expect(isLogLevel(3)).toBe(false);
  });

  it('reads the level from chrome.storage.local and follows later changes', async () => {
    const chrome = chromeMock();
    await chrome.storage.local.set({ log_level: 'debug' });
    await initLogLevelFromStorage();
    expect(getLogLevel()).toBe('debug');

    const [listener] = chrome.storage.onChanged.listeners as Set<
      (changes: Record<string, { newValue?: unknown }>, area: string) => void
    >;
    listener({ log_level: { newValue: 'warn' } }, 'local');
    expect(getLogLevel()).toBe('warn');

    listener({ log_level: { newValue: 'nonsense' } }, 'local');
    listener({ log_level: { newValue: 'error' } }, 'session');
    expect(getLogLevel()).toBe('warn');
  });

  it('keeps the default when storage holds no level', async () => {
    await initLogLevelFromStorage();
    expect(getLogLevel()).toBe('info');
  });
});

describe('describeError', () => {
  it.each([
    [new Error('boom'), 'boom'],
    ['plain text', 'plain text'],
    [{ code: 7 }, '{"code":7}'],
    [undefined, 'undefined'],
  ])('describes %j', (input, expected) => {
    expect(describeError(input)).toBe(expected);
  });
});
