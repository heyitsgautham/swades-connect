import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { installChromeMock } from './chromeMock';

// Every test gets an empty chrome.storage and fresh spies.
beforeEach(() => {
  installChromeMock();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});
