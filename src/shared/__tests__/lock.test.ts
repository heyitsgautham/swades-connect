import { describe, expect, it, vi } from 'vitest';
import { acquireLock, releaseLock, waitForLock } from '../lock';
import { chromeMock } from '../../test/chromeMock';

describe('lock', () => {
  it('grants the lock when nobody holds it', async () => {
    expect(await acquireLock('a')).toBe(true);
    expect(chromeMock().storage.session.dump().extraction_lock).toMatchObject({ id: 'a' });
  });

  it('refuses a second holder while the first lock is fresh', async () => {
    await acquireLock('a');
    expect(await acquireLock('b')).toBe(false);
  });

  it('takes over a lock older than 30 seconds', async () => {
    vi.useFakeTimers();
    await acquireLock('stale');
    vi.advanceTimersByTime(30_001);
    expect(await acquireLock('fresh')).toBe(true);
    expect(chromeMock().storage.session.dump().extraction_lock).toMatchObject({ id: 'fresh' });
  });

  it('only releases the lock for its own id', async () => {
    await acquireLock('owner');
    await releaseLock('intruder');
    expect(await acquireLock('other')).toBe(false);

    await releaseLock('owner');
    expect(await acquireLock('other')).toBe(true);
  });

  it('waitForLock succeeds once the holder releases', async () => {
    vi.useFakeTimers();
    await acquireLock('holder');
    const waiting = waitForLock('waiter', 1000);
    await vi.advanceTimersByTimeAsync(250);
    await releaseLock('holder');
    await vi.advanceTimersByTimeAsync(150);
    expect(await waiting).toBe(true);
  });

  it('waitForLock gives up after maxWaitMs', async () => {
    vi.useFakeTimers();
    await acquireLock('holder');
    const waiting = waitForLock('waiter', 500);
    await vi.advanceTimersByTimeAsync(600);
    expect(await waiting).toBe(false);
  });
});
