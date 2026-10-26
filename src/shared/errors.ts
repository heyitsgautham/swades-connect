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

/** A request from the popup to the service worker failed, got no reply, or got a reply in the wrong shape. */
export class BackgroundRequestError extends Error {
  readonly kind = 'background-request' as const;
  readonly action: string;

  constructor(message: string, action: string) {
    super(message);
    this.name = 'BackgroundRequestError';
    this.action = action;
  }
}
