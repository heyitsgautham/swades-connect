/**
 * Shadow DOM Visual Feedback Indicator
 * Injected into Odoo pages via content script to show extraction status.
 * Uses Shadow DOM with mode: 'closed' for complete CSS isolation.
 */

const INDICATOR_ID = 'swades-shadow-indicator';

const STATUS_COLORS: Record<string, string> = {
  idle: '#6b7280',
  extracting: '#f59e0b',
  success: '#10b981',
  error: '#973131',
};

export type IndicatorState = 'idle' | 'extracting' | 'success' | 'error';

let shadowHost: HTMLElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let statusDot: HTMLElement | null = null;
let statusText: HTMLElement | null = null;
let hideTimeout: number | null = null;

/**
 * Ensures a host element exists for the Shadow DOM.
 * Prevents duplicate mounts by checking for existing host.
 */
function ensureHost(): HTMLElement {
  const existing = document.getElementById(INDICATOR_ID);
  if (existing) return existing;

  const host = document.createElement('div');
  host.id = INDICATOR_ID;
  host.style.position = 'fixed';
  host.style.bottom = '16px';
  host.style.right = '16px';
  host.style.zIndex = '2147483647'; // Max z-index to stay on top
  document.body.appendChild(host);
  return host;
}

/**
 * Creates isolated styles for the indicator.
 * Uses the Swades Connect color palette.
 */
function createStyles(): HTMLStyleElement {
  const style = document.createElement('style');
  style.textContent = `
    :host {
      all: initial;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .indicator {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #FFFFFF;
      border: 1px solid #FFF4DB;
      border-radius: 9999px;
      padding: 8px 14px;
      box-shadow: 0 4px 12px rgba(151, 49, 49, 0.12), 0 2px 4px rgba(0, 0, 0, 0.08);
      color: #1D1D28;
      backdrop-filter: blur(6px);
      transition: opacity 0.2s ease, transform 0.2s ease;
    }
    .indicator:hover {
      box-shadow: 0 6px 16px rgba(151, 49, 49, 0.16), 0 2px 6px rgba(0, 0, 0, 0.1);
    }
    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: ${STATUS_COLORS.idle};
      box-shadow: 0 0 0 3px rgba(107, 114, 128, 0.15);
      transition: background 0.2s ease, box-shadow 0.2s ease;
    }
    .dot.extracting {
      animation: pulse 1.5s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% {
        box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.2);
      }
      50% {
        box-shadow: 0 0 0 6px rgba(245, 158, 11, 0.3);
      }
    }
    .text {
      font-size: 12px;
      font-weight: 600;
      color: #1D1D28;
      letter-spacing: -0.01em;
    }
    .hidden {
      opacity: 0;
      transform: translateY(6px);
      pointer-events: none;
    }
  `;
  return style;
}

/**
 * Mounts the indicator into the page using Shadow DOM.
 * Safe to call multiple times - will not create duplicates.
 */
export function mountIndicator(): void {
  // Prevent duplicate mounts
  if (shadowRoot) return;

  shadowHost = ensureHost();
  
  // Check if shadow root already exists (from previous mount)
  if (shadowHost.shadowRoot) {
    // Host exists but we lost our reference - clean up and remount
    shadowHost.remove();
    shadowHost = ensureHost();
  }

  shadowRoot = shadowHost.attachShadow({ mode: 'closed' });

  const wrapper = document.createElement('div');
  wrapper.className = 'indicator hidden';

  statusDot = document.createElement('div');
  statusDot.className = 'dot';

  statusText = document.createElement('span');
  statusText.className = 'text';
  statusText.textContent = 'Idle';

  wrapper.appendChild(statusDot);
  wrapper.appendChild(statusText);

  shadowRoot.appendChild(createStyles());
  shadowRoot.appendChild(wrapper);

  // Fade in after a brief delay for smooth animation
  requestAnimationFrame(() => {
    wrapper.classList.remove('hidden');
  });
}

/**
 * Updates the indicator state and message.
 * Auto-hides after success (2 seconds).
 */
export function setIndicatorState(state: IndicatorState, message?: string): void {
  if (!shadowRoot || !statusDot || !statusText) return;

  const color = STATUS_COLORS[state] || STATUS_COLORS.idle;
  statusDot.style.background = color;
  
  // Update dot shadow color based on state
  const shadowColors: Record<string, string> = {
    idle: 'rgba(107, 114, 128, 0.15)',
    extracting: 'rgba(245, 158, 11, 0.2)',
    success: 'rgba(16, 185, 129, 0.2)',
    error: 'rgba(151, 49, 49, 0.2)',
  };
  statusDot.style.boxShadow = `0 0 0 3px ${shadowColors[state] || shadowColors.idle}`;

  // Toggle pulse animation for extracting state
  if (state === 'extracting') {
    statusDot.classList.add('extracting');
  } else {
    statusDot.classList.remove('extracting');
  }

  statusText.textContent = message || state.charAt(0).toUpperCase() + state.slice(1);

  // Clear any existing hide timeout
  if (hideTimeout !== null) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }

  const wrapper = statusDot.parentElement as HTMLElement;
  wrapper.classList.remove('hidden');

  // Return to idle state after showing success for 2 seconds
  if (state === 'success') {
    hideTimeout = window.setTimeout(() => {
      setIndicatorState('idle', 'Idle');
    }, 2000);
  }
}

/**
 * Unmounts the indicator from the page.
 * Cleans up all references and timeouts.
 */
export function unmountIndicator(): void {
  if (hideTimeout !== null) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }

  if (shadowHost) {
    shadowHost.remove();
  }

  shadowHost = null;
  shadowRoot = null;
  statusDot = null;
  statusText = null;
}
