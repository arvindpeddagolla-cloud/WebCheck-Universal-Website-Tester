/**
 * WebCheck — In-Page Telemetry Bridge (MAIN World)
 * Injected into the host page context to observe runtime errors,
 * unhandled promise rejections, and failed HTTP requests directly.
 * 
 * Strict Privacy:
 * - NO headers, cookies, passwords, or payload bodies are read or transmitted.
 * - Only error messages, stack traces, and HTTP error status codes are forwarded.
 */

(function () {
  // Prevent multiple injections
  if (window.__WEBCHECK_BRIDGE_INITIALIZED__) return;
  window.__WEBCHECK_BRIDGE_INITIALIZED__ = true;

  function emitTelemetry(entry) {
    try {
      window.dispatchEvent(
        new CustomEvent('__WEBCHECK_TELEMETRY__', {
          detail: {
            ...entry,
            timestamp: Date.now()
          }
        })
      );
    } catch (e) {
      // Graceful failover
    }
  }

  // 1. Observe uncaught JavaScript runtime exceptions
  window.addEventListener('error', function (event) {
    // Discriminate between JS exceptions and resource loading errors
    if (event.error || event.message) {
      emitTelemetry({
        type: 'javascript_error',
        message: event.message || (event.error && event.error.message) || 'Uncaught error',
        filename: event.filename || '',
        lineno: event.lineno || 0,
        colno: event.colno || 0,
        stack: (event.error && event.error.stack) ? event.error.stack.slice(0, 1000) : ''
      });
    } else if (event.target && (event.target.tagName === 'IMG' || event.target.tagName === 'SCRIPT' || event.target.tagName === 'LINK')) {
      const tag = event.target.tagName.toLowerCase();
      const src = event.target.src || event.target.href || '';
      emitTelemetry({
        type: 'resource_error',
        tag: tag,
        url: src ? src.slice(0, 500) : '',
        message: `Failed to load ${tag} resource`
      });
    }
  }, true); // Use capture to intercept resource errors

  // 2. Observe unhandled Promise rejections
  window.addEventListener('unhandledrejection', function (event) {
    let reasonMessage = 'Unhandled Promise Rejection';
    let stack = '';

    if (typeof event.reason === 'string') {
      reasonMessage = event.reason;
    } else if (event.reason instanceof Error) {
      reasonMessage = event.reason.message;
      stack = event.reason.stack ? event.reason.stack.slice(0, 1000) : '';
    } else if (event.reason && typeof event.reason === 'object') {
      try {
        reasonMessage = JSON.stringify(event.reason);
      } catch (_) {
        reasonMessage = String(event.reason);
      }
    }

    emitTelemetry({
      type: 'unhandled_rejection',
      message: reasonMessage,
      stack: stack
    });
  });

  // 3. Observe failed Fetch API calls (HTTP >= 400 or network failure)
  if (typeof window.fetch === 'function') {
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || 'Unknown URL';
      const method = (args[1] && args[1].method) || (args[0] && args[0].method) || 'GET';
      
      try {
        const response = await originalFetch.apply(this, args);
        if (!response.ok) {
          emitTelemetry({
            type: 'failed_request',
            method: method.toUpperCase(),
            url: typeof url === 'string' ? url.slice(0, 500) : '',
            status: response.status,
            statusText: response.statusText || 'HTTP Error'
          });
        }
        return response;
      } catch (err) {
        emitTelemetry({
          type: 'failed_request',
          method: method.toUpperCase(),
          url: typeof url === 'string' ? url.slice(0, 500) : '',
          status: 0,
          statusText: err.message || 'Network Fetch Failed'
        });
        throw err;
      }
    };
  }

  // 4. Observe failed XMLHttpRequest calls
  if (typeof window.XMLHttpRequest === 'function') {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
      this._webcheck_method = method;
      this._webcheck_url = url;
      return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function () {
      this.addEventListener('load', function () {
        if (this.status >= 400) {
          emitTelemetry({
            type: 'failed_request',
            method: (this._webcheck_method || 'GET').toUpperCase(),
            url: typeof this._webcheck_url === 'string' ? this._webcheck_url.slice(0, 500) : '',
            status: this.status,
            statusText: this.statusText || 'XHR Error'
          });
        }
      });

      this.addEventListener('error', function () {
        emitTelemetry({
          type: 'failed_request',
          method: (this._webcheck_method || 'GET').toUpperCase(),
          url: typeof this._webcheck_url === 'string' ? this._webcheck_url.slice(0, 500) : '',
          status: 0,
          statusText: 'XHR Network Failure'
        });
      });

      return originalSend.apply(this, arguments);
    };
  }
})();
