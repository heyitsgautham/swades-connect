/**
 * Odoo RPC Interceptor
 *
 * This script is injected into the page context to intercept Odoo's RPC calls.
 * It monkeypatches fetch and XMLHttpRequest to detect create/edit/delete operations.
 *
 * The intercepted data is sent via window.postMessage for the content script to consume.
 */

import { createLogger, describeError } from '../shared/logger';

const log = createLogger('interceptor');

// ============================================================================
// Type Definitions
// ============================================================================

export type OdooRpcMethod =
  'create' | 'write' | 'unlink' | 'web_save' | 'action_done' | 'name_create' | 'web_search_read' | 'web_read_group';

export interface OdooRpcPayload {
  model: string;
  method: OdooRpcMethod;
  args: unknown[];
  result: unknown;
  url: string;
  ts: number;
}

export interface OdooRpcSignal {
  source: 'odoo-rpc-interceptor';
  payload: OdooRpcPayload;
}

// Models we care about for the CRM extension
// mail.activity.schedule is used for creating new activities via the scheduling wizard
export const RELEVANT_MODELS = ['res.partner', 'crm.lead', 'mail.activity', 'mail.activity.schedule'] as const;
export type RelevantModel = (typeof RELEVANT_MODELS)[number];

// Methods that indicate data changes
// action_done is used for marking activities as done (deletion)
// name_create is used for quick contact creation (e.g., from opportunity forms)
// web_search_read and web_read_group are used to capture real Odoo IDs when loading list/kanban views
// web_read_group is used by kanban views with grouping (like opportunities by stage)
export const INTERCEPTED_METHODS: OdooRpcMethod[] = [
  'create',
  'write',
  'unlink',
  'web_save',
  'action_done',
  'name_create',
  'web_search_read',
  'web_read_group',
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a script element that loads the external interceptor script.
 * Using external script file to comply with CSP policies (inline scripts blocked).
 */
export function createInterceptorScript(): HTMLScriptElement {
  const script = document.createElement('script');
  // Use external file instead of inline content to avoid CSP violations
  script.src = chrome.runtime.getURL('rpc-interceptor.js');
  return script;
}

/**
 * Injects the RPC interceptor into the page.
 * Should be called from content script as early as possible.
 * Uses external script file to comply with Odoo's Content Security Policy.
 */
export function injectRpcInterceptor(): void {
  const script = createInterceptorScript();
  script.onload = () => {
    log.debug('RPC interceptor script loaded successfully');
    script.remove(); // Clean up after loading
  };
  script.onerror = (error) => {
    log.error('Failed to load RPC interceptor script', { error: describeError(error) });
  };
  (document.head || document.documentElement).appendChild(script);
}

/**
 * Type guard to check if a message is an OdooRpcSignal
 */
export function isOdooRpcSignal(data: unknown): data is OdooRpcSignal {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const obj = data as Record<string, unknown>;
  return obj.source === 'odoo-rpc-interceptor' && typeof obj.payload === 'object' && obj.payload !== null;
}

/**
 * Type guard to check if a model is one we care about
 */
export function isRelevantModel(model: string): model is RelevantModel {
  return RELEVANT_MODELS.includes(model as RelevantModel);
}

/**
 * Setup a listener for RPC signals in the content script.
 * Returns a cleanup function to remove the listener.
 */
export function setupRpcSignalListener(callback: (signal: OdooRpcSignal) => void): () => void {
  const handler = (event: MessageEvent) => {
    // Only accept messages from the same window
    if (event.source !== window) {
      return;
    }

    if (isOdooRpcSignal(event.data)) {
      callback(event.data);
    }
  };

  window.addEventListener('message', handler);

  return () => {
    window.removeEventListener('message', handler);
  };
}
