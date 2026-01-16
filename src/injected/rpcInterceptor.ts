/**
 * Odoo RPC Interceptor
 *
 * This script is injected into the page context to intercept Odoo's RPC calls.
 * It monkeypatches fetch and XMLHttpRequest to detect create/edit/delete operations.
 *
 * The intercepted data is sent via window.postMessage for the content script to consume.
 */

// ============================================================================
// Type Definitions
// ============================================================================

export type OdooRpcMethod = 'create' | 'write' | 'unlink' | 'web_save' | 'action_done' | 'name_create' | 'web_search_read' | 'web_read_group';

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
export const INTERCEPTED_METHODS: OdooRpcMethod[] = ['create', 'write', 'unlink', 'web_save', 'action_done', 'name_create', 'web_search_read', 'web_read_group'];

// ============================================================================
// Injectable Script Code
// ============================================================================

/**
 * The actual interceptor code that runs in the page context.
 * This is exported as a string so it can be injected via a <script> tag.
 */
export const RPC_INTERCEPTOR_SCRIPT = `
(function() {
  'use strict';

  // Idempotency check - don't install twice
  if (window.__odoo_rpc_interceptor_installed) {
    console.log('[Odoo RPC Interceptor] Already installed, skipping...');
    return;
  }
  window.__odoo_rpc_interceptor_installed = true;

  // Configuration
  // mail.activity.schedule is used for creating new activities via the scheduling wizard
  const RELEVANT_MODELS = ['res.partner', 'crm.lead', 'mail.activity', 'mail.activity.schedule'];
  // action_done is used for marking activities as done (deletion)
  // name_create is used for quick contact creation (e.g., from opportunity forms)
  // web_search_read is used to capture real Odoo IDs when loading list/kanban views
  const INTERCEPTED_METHODS = ['create', 'write', 'unlink', 'web_save', 'action_done', 'name_create', 'web_search_read'];
  // Match both /call_kw/ and /call_button/ endpoints
  // call_button is used for action_done and some unlink operations on activities
  const RPC_ENDPOINT_PATTERN = /\\/web\\/dataset\\/call_(?:kw|button)\\/([^/]+)\\/([^/?]+)/;

  console.log('[Odoo RPC Interceptor] Installing interceptors...');

  /**
   * Parse the RPC endpoint URL to extract model and method
   */
  function parseRpcEndpoint(url) {
    try {
      const urlPath = new URL(url, window.location.origin).pathname;
      const match = urlPath.match(RPC_ENDPOINT_PATTERN);
      if (match) {
        return { model: match[1], method: match[2] };
      }
    } catch (e) {
      // Invalid URL, ignore
    }
    return null;
  }

  /**
   * Check if we should intercept this RPC call
   */
  function shouldIntercept(model, method) {
    return RELEVANT_MODELS.includes(model) && INTERCEPTED_METHODS.includes(method);
  }

  /**
   * Emit the intercepted RPC signal to the content script
   */
  function emitRpcSignal(model, method, args, result, url) {
    const signal = {
      source: 'odoo-rpc-interceptor',
      payload: {
        model: model,
        method: method,
        args: args,
        result: result,
        url: url,
        ts: Date.now()
      }
    };

    console.log('[Odoo RPC Interceptor] Emitting signal:', signal.payload.model, signal.payload.method);
    window.postMessage(signal, '*');
  }

  /**
   * Try to parse JSON safely
   */
  function safeParseJSON(text) {
    try {
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  }

  // ========================================================================
  // Fetch Interceptor
  // ========================================================================

  const originalFetch = window.fetch;

  window.fetch = async function(...args) {
    const [input, init] = args;
    const url = typeof input === 'string' ? input : input.url;

    // Check if this is an RPC call we care about
    const rpcInfo = parseRpcEndpoint(url);

    if (rpcInfo && shouldIntercept(rpcInfo.model, rpcInfo.method)) {
      // Extract request body for args
      let requestArgs = [];
      if (init && init.body) {
        const bodyData = safeParseJSON(init.body);
        if (bodyData && bodyData.params && bodyData.params.args) {
          requestArgs = bodyData.params.args;
        }
      }

      try {
        // Make the actual request
        const response = await originalFetch.apply(this, args);

        // Clone response so we can read the body
        const clonedResponse = response.clone();

        // Read and parse the response
        clonedResponse.text().then(text => {
          const jsonResponse = safeParseJSON(text);
          if (jsonResponse && jsonResponse.result !== undefined) {
            emitRpcSignal(
              rpcInfo.model,
              rpcInfo.method,
              requestArgs,
              jsonResponse.result,
              url
            );
          }
        }).catch(err => {
          console.warn('[Odoo RPC Interceptor] Failed to read fetch response:', err);
        });

        return response;
      } catch (error) {
        throw error;
      }
    }

    // Not an RPC call we care about, pass through
    return originalFetch.apply(this, args);
  };

  console.log('[Odoo RPC Interceptor] Fetch interceptor installed');

  // ========================================================================
  // XMLHttpRequest Interceptor
  // ========================================================================

  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    // Store the URL for later use
    this.__rpcInterceptorUrl = url;
    this.__rpcInterceptorMethod = method;
    return originalXHROpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function(body) {
    const url = this.__rpcInterceptorUrl;
    const rpcInfo = parseRpcEndpoint(url);

    if (rpcInfo && shouldIntercept(rpcInfo.model, rpcInfo.method)) {
      // Extract request body for args
      let requestArgs = [];
      if (body) {
        const bodyData = safeParseJSON(body);
        if (bodyData && bodyData.params && bodyData.params.args) {
          requestArgs = bodyData.params.args;
        }
      }

      // Store for the load handler
      this.__rpcInterceptorInfo = {
        model: rpcInfo.model,
        method: rpcInfo.method,
        args: requestArgs,
        url: url
      };

      // Add load listener to capture response
      this.addEventListener('load', function() {
        if (this.__rpcInterceptorInfo && this.status >= 200 && this.status < 300) {
          try {
            const jsonResponse = safeParseJSON(this.responseText);
            if (jsonResponse && jsonResponse.result !== undefined) {
              emitRpcSignal(
                this.__rpcInterceptorInfo.model,
                this.__rpcInterceptorInfo.method,
                this.__rpcInterceptorInfo.args,
                jsonResponse.result,
                this.__rpcInterceptorInfo.url
              );
            }
          } catch (err) {
            console.warn('[Odoo RPC Interceptor] Failed to parse XHR response:', err);
          }
        }
      });
    }

    return originalXHRSend.apply(this, [body]);
  };

  console.log('[Odoo RPC Interceptor] XHR interceptor installed');
  console.log('[Odoo RPC Interceptor] Ready! Monitoring models:', RELEVANT_MODELS.join(', '));
})();
`;

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
    console.log('[Swades Connect] RPC interceptor script loaded successfully');
    script.remove(); // Clean up after loading
  };
  script.onerror = (error) => {
    console.error('[Swades Connect] Failed to load RPC interceptor script:', error);
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
  return (
    obj.source === 'odoo-rpc-interceptor' &&
    typeof obj.payload === 'object' &&
    obj.payload !== null
  );
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
export function setupRpcSignalListener(
  callback: (signal: OdooRpcSignal) => void
): () => void {
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
