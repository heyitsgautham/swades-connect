import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createLogger,
  describeError,
  formatJsonLine,
  getLogFormat,
  getLogLevel,
  initLoggingFromStorage,
  isLogLevel,
  setLogFormat,
  setLogLevel,
} from '../logger';
import { chromeMock } from '../../test/chromeMock';

describe('logger', () => {
  beforeEach(() => {
    setLogLevel('info');
    setLogFormat('text');
  });
  afterEach(() => {
    setLogLevel('info');
    setLogFormat('text');
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
    await initLoggingFromStorage();
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
    await initLoggingFromStorage();
    expect(getLogLevel()).toBe('info');
    expect(getLogFormat()).toBe('text');
  });

  it('emits one JSON line per entry when the format is json', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-26T18:30:00.000Z'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setLogFormat('json');

    createLogger('rpc').warn('odd payload', { model: 'res.partner', ids: [7] });

    expect(warn).toHaveBeenCalledOnce();
    expect(JSON.parse(warn.mock.calls[0][0] as string)).toEqual({
      ts: '2026-10-26T18:30:00.000Z',
      level: 'warn',
      scope: 'rpc',
      message: 'odd payload',
      context: { model: 'res.partner', ids: [7] },
    });
  });

  it('still applies the minimum level in json format', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    setLogFormat('json');
    createLogger('x').debug('hidden');
    expect(debug).not.toHaveBeenCalled();
  });

  it('reads the format from chrome.storage.local and falls back to text on a bad value', async () => {
    const chrome = chromeMock();
    await chrome.storage.local.set({ log_format: 'json' });
    await initLoggingFromStorage();
    expect(getLogFormat()).toBe('json');

    const [listener] = chrome.storage.onChanged.listeners as Set<
      (changes: Record<string, { newValue?: unknown }>, area: string) => void
    >;
    listener({ log_format: { newValue: 'yaml' } }, 'local');
    expect(getLogFormat()).toBe('text');
  });
});

describe('formatJsonLine', () => {
  const now = new Date('2026-01-02T03:04:05.000Z');

  it('leaves out context when there is none', () => {
    expect(JSON.parse(formatJsonLine('info', 'storage', 'saved', undefined, now))).toEqual({
      ts: '2026-01-02T03:04:05.000Z',
      level: 'info',
      scope: 'storage',
      message: 'saved',
    });
  });

  it('keeps the name and message of an Error in the context', () => {
    const line = formatJsonLine('error', 'rpc', 'failed', { error: new TypeError('bad id') }, now);
    expect(JSON.parse(line).context).toEqual({ error: { name: 'TypeError', message: 'bad id' } });
  });

  it('describes a context that cannot be serialised instead of throwing', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const line = formatJsonLine('warn', 'x', 'loop', circular, now);
    expect(JSON.parse(line)).toMatchObject({ message: 'loop', context: '[object Object]' });
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
