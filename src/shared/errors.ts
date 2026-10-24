/**
 * Tagged error types, so callers and logs can tell failure kinds apart
 * without matching on message text.
 */

/** A chrome.storage write could not run, for example because the lock stayed taken. */
export class StorageError extends Error {
  readonly kind = 'storage' as const;
  readonly context: Record<string, unknown>;

  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message);
    this.name = 'StorageError';
    this.context = context;
  }
}
