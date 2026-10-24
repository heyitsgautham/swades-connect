/**
 * Small leveled logger shared by the service worker, content script and popup.
 *
 * Every line carries a scope tag and an optional context object, so a filter on
 * "[Swades Connect:rpc]" in DevTools shows one subsystem, and the context
 * stays inspectable instead of being flattened into the message string.
 *
 * The minimum level defaults to "info". Set `log_level` in chrome.storage.local
 * to "debug" to see the chatty per-message traces, for example from the
 * service worker console: chrome.storage.local.set({ log_level: 'debug' }).
 */

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export const LOG_LEVEL_STORAGE_KEY = 'log_level';

const RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

let minLevel: LogLevel = 'info';

export function isLogLevel(value: unknown): value is LogLevel {
  return typeof value === 'string' && (LOG_LEVELS as readonly string[]).includes(value);
}

export function setLogLevel(level: LogLevel): void {
  minLevel = level;
}

export function getLogLevel(): LogLevel {
  return minLevel;
}

export type LogContext = Record<string, unknown>;

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}

const SINK: Record<LogLevel, (...args: unknown[]) => void> = {
  debug: (...args) => console.debug(...args),
  info: (...args) => console.info(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};

export function createLogger(scope: string): Logger {
  const emit = (level: LogLevel, message: string, context?: LogContext) => {
    if (RANK[level] < RANK[minLevel]) return;
    const line = `[Swades Connect:${scope}] ${message}`;
    if (context === undefined) SINK[level](line);
    else SINK[level](line, context);
  };

  return {
    debug: (message, context) => emit('debug', message, context),
    info: (message, context) => emit('info', message, context),
    warn: (message, context) => emit('warn', message, context),
    error: (message, context) => emit('error', message, context),
  };
}

/** Turn an unknown thrown value into something a log context can hold. */
export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error) ?? String(error);
  } catch {
    return String(error);
  }
}

/**
 * Read the level from chrome.storage.local and follow later changes.
 * Safe to call in any extension context; failures leave the default level.
 */
export async function initLogLevelFromStorage(): Promise<void> {
  try {
    const stored = await chrome.storage.local.get(LOG_LEVEL_STORAGE_KEY);
    const level = stored[LOG_LEVEL_STORAGE_KEY];
    if (isLogLevel(level)) setLogLevel(level);

    chrome.storage.onChanged.addListener((changes, areaName) => {
      const change = changes[LOG_LEVEL_STORAGE_KEY];
      if (areaName === 'local' && change && isLogLevel(change.newValue)) {
        setLogLevel(change.newValue);
      }
    });
  } catch {
    // Storage is unavailable (for example in a test page); keep the default.
  }
}
