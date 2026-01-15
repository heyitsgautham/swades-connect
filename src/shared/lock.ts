// Simple mutex lock using chrome.storage.session
const LOCK_KEY = 'extraction_lock';
const LOCK_TIMEOUT_MS = 30000; // 30 seconds

interface LockData {
  id: string;
  timestamp: number;
}

export async function acquireLock(id: string): Promise<boolean> {
  const lockData = await chrome.storage.session.get(LOCK_KEY);
  const currentLock = lockData[LOCK_KEY] as LockData | undefined;

  if (currentLock && Date.now() - currentLock.timestamp < LOCK_TIMEOUT_MS) {
    return false; // Lock already held
  }

  // Acquire lock
  await chrome.storage.session.set({
    [LOCK_KEY]: { id, timestamp: Date.now() },
  });

  return true;
}

export async function releaseLock(id: string): Promise<void> {
  const lockData = await chrome.storage.session.get(LOCK_KEY);
  const currentLock = lockData[LOCK_KEY] as LockData | undefined;

  if (currentLock && currentLock.id === id) {
    await chrome.storage.session.remove(LOCK_KEY);
  }
}

export async function waitForLock(id: string, maxWaitMs: number = 5000): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    if (await acquireLock(id)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return false;
}
