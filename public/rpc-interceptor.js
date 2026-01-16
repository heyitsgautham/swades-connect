/**
 * Odoo RPC Interceptor - Page Context Script
 * 
 * This script is injected into the page context to intercept Odoo's RPC calls.
 * It must be a separate file (not inline) to comply with CSP policies.
 */
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
  var RELEVANT_MODELS = ['res.partner', 'crm.lead', 'mail.activity', 'mail.activity.schedule'];
  // action_done is used for marking activities as done (deletion)
  // name_create is used for quick contact creation (e.g., from opportunity forms)
  // web_search_read and web_read_group are used to capture real Odoo IDs when loading list/kanban views
  // web_read_group is used by kanban views with grouping (like opportunities by stage)
  var INTERCEPTED_METHODS = ['create', 'write', 'unlink', 'web_save', 'action_done', 'name_create', 'web_search_read', 'web_read_group'];
  // Match both /call_kw/ and /call_button/ endpoints
  // call_button is used for action_done and some unlink operations on activities
  var RPC_ENDPOINT_PATTERN = /\/web\/dataset\/call_(?:kw|button)\/([^/]+)\/([^/?]+)/;

  console.log('[Odoo RPC Interceptor] Installing interceptors...');

  /**
   * Parse the RPC endpoint URL to extract model and method
   */
  function parseRpcEndpoint(url) {
    try {
      var urlPath = new URL(url, window.location.origin).pathname;
      var match = urlPath.match(RPC_ENDPOINT_PATTERN);
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
    return RELEVANT_MODELS.indexOf(model) !== -1 && INTERCEPTED_METHODS.indexOf(method) !== -1;
  }

  /**
   * Emit the intercepted RPC signal to the content script
   */
  function emitRpcSignal(model, method, args, result, url) {
    var signal = {
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

  var originalFetch = window.fetch;

  window.fetch = function() {
    var args = arguments;
    var input = args[0];
    var init = args[1];
    var url = typeof input === 'string' ? input : (input && input.url ? input.url : '');

    // Check if this is an RPC call we care about
    var rpcInfo = parseRpcEndpoint(url);

    if (rpcInfo && shouldIntercept(rpcInfo.model, rpcInfo.method)) {
      // Extract request body for args
      var requestArgs = [];
      if (init && init.body) {
        var bodyData = safeParseJSON(init.body);
        if (bodyData && bodyData.params && bodyData.params.args) {
          requestArgs = bodyData.params.args;
        }
      }

      // Make the actual request
      return originalFetch.apply(this, args).then(function(response) {
        // Clone response so we can read the body
        var clonedResponse = response.clone();

        // Read and parse the response
        clonedResponse.text().then(function(text) {
          var jsonResponse = safeParseJSON(text);
          if (jsonResponse && jsonResponse.result !== undefined) {
            emitRpcSignal(
              rpcInfo.model,
              rpcInfo.method,
              requestArgs,
              jsonResponse.result,
              url
            );
          }
        }).catch(function(err) {
          console.warn('[Odoo RPC Interceptor] Failed to read fetch response:', err);
        });

        return response;
      });
    }

    // Not an RPC call we care about, pass through
    return originalFetch.apply(this, args);
  };

  console.log('[Odoo RPC Interceptor] Fetch interceptor installed');

  // ========================================================================
  // XMLHttpRequest Interceptor
  // ========================================================================

  var originalXHROpen = XMLHttpRequest.prototype.open;
  var originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url) {
    // Store the URL for later use
    this.__rpcInterceptorUrl = url;
    this.__rpcInterceptorMethod = method;
    return originalXHROpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function(body) {
    var xhr = this;
    var url = this.__rpcInterceptorUrl;
    var rpcInfo = parseRpcEndpoint(url);

    if (rpcInfo && shouldIntercept(rpcInfo.model, rpcInfo.method)) {
      // Extract request body for args
      var requestArgs = [];
      if (body) {
        var bodyData = safeParseJSON(body);
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
        if (xhr.__rpcInterceptorInfo && xhr.status >= 200 && xhr.status < 300) {
          try {
            var jsonResponse = safeParseJSON(xhr.responseText);
            if (jsonResponse && jsonResponse.result !== undefined) {
              emitRpcSignal(
                xhr.__rpcInterceptorInfo.model,
                xhr.__rpcInterceptorInfo.method,
                xhr.__rpcInterceptorInfo.args,
                jsonResponse.result,
                xhr.__rpcInterceptorInfo.url
              );
            }
          } catch (err) {
            console.warn('[Odoo RPC Interceptor] Failed to parse XHR response:', err);
          }
        }
      });
    }

    return originalXHRSend.apply(this, arguments);
  };

  console.log('[Odoo RPC Interceptor] XHR interceptor installed');
  console.log('[Odoo RPC Interceptor] Ready! Monitoring models:', RELEVANT_MODELS.join(', '));
})();
