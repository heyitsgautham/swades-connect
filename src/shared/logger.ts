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
 *
 * Set `log_format` to "json" to get one JSON object per line instead,
 * { ts, level, scope, message, context }, which is easier to filter and to paste into a bug report.
 */

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export const LOG_LEVEL_STORAGE_KEY = 'log_level';

const RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

let minLevel: LogLevel = 'info';

export const LOG_FORMATS = ['text', 'json'] as const;
export type LogFormat = (typeof LOG_FORMATS)[number];

export const LOG_FORMAT_STORAGE_KEY = 'log_format';

let format: LogFormat = 'text';

export function isLogLevel(value: unknown): value is LogLevel {
  return typeof value === 'string' && (LOG_LEVELS as readonly string[]).includes(value);
}

export function setLogLevel(level: LogLevel): void {
  minLevel = level;
}

export function getLogLevel(): LogLevel {
  return minLevel;
}

export function isLogFormat(value: unknown): value is LogFormat {
  return typeof value === 'string' && (LOG_FORMATS as readonly string[]).includes(value);
}

export function setLogFormat(next: LogFormat): void {
  format = next;
}

export function getLogFormat(): LogFormat {
  return format;
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

/** JSON.stringify replacer that keeps an Error's name and message, which plain JSON drops. */
function errorReplacer(_key: string, value: unknown): unknown {
  return value instanceof Error ? { name: value.name, message: value.message } : value;
}

/** One log entry as a single JSON line. A context that cannot be serialised is replaced by its description. */
export function formatJsonLine(
  level: LogLevel,
  scope: string,
  message: string,
  context?: LogContext,
  now = new Date(),
): string {
  const entry = { ts: now.toISOString(), level, scope, message, ...(context !== undefined && { context }) };
  try {
    return JSON.stringify(entry, errorReplacer);
  } catch {
    return JSON.stringify({ ...entry, context: describeError(context) });
  }
}

export function createLogger(scope: string): Logger {
  const emit = (level: LogLevel, message: string, context?: LogContext) => {
    if (RANK[level] < RANK[minLevel]) return;
    if (format === 'json') {
      SINK[level](formatJsonLine(level, scope, message, context));
      return;
    }
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
 * Read the level and format from chrome.storage.local and follow later changes.
 * Safe to call in any extension context; failures leave the defaults.
 */
export async function initLoggingFromStorage(): Promise<void> {
  try {
    const stored = await chrome.storage.local.get([LOG_LEVEL_STORAGE_KEY, LOG_FORMAT_STORAGE_KEY]);
    const level = stored[LOG_LEVEL_STORAGE_KEY];
    if (isLogLevel(level)) setLogLevel(level);
    const storedFormat = stored[LOG_FORMAT_STORAGE_KEY];
    if (isLogFormat(storedFormat)) setLogFormat(storedFormat);

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;
      const levelChange = changes[LOG_LEVEL_STORAGE_KEY];
      if (levelChange && isLogLevel(levelChange.newValue)) setLogLevel(levelChange.newValue);
      const formatChange = changes[LOG_FORMAT_STORAGE_KEY];
      if (formatChange) setLogFormat(isLogFormat(formatChange.newValue) ? formatChange.newValue : 'text');
    });
  } catch {
    // Storage is unavailable (for example in a test page); keep the defaults.
  }
}
