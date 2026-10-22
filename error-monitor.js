/**
 * WebCheck — Content Script Error & Telemetry Monitor
 * Listens for telemetry dispatched by page-bridge.js and local isolated DOM errors.
 */

const WebCheckErrorMonitor = (function () {
  const errorLog = [];
  const MAX_LOGS = 100;
  let initialized = false;

  function init() {
    if (initialized) return;
    initialized = true;

    // Inject page-bridge.js into the main document to bridge runtime errors
    try {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('page-bridge.js');
      script.async = false;
      (document.head || document.documentElement).appendChild(script);
      script.onload = () => script.remove();
    } catch (e) {
      // Content security policy or restricted page may block script injection
      console.warn('[WebCheck] Main-world bridge injection restricted by host CSP:', e.message);
    }

    // Listen to bridged events from page-bridge.js
    window.addEventListener('__WEBCHECK_TELEMETRY__', function (e) {
      if (e.detail) {
        addEntry(e.detail);
      }
    });

    // Content script local capture for resource load failures
    window.addEventListener('error', function (e) {
      if (e.target && e.target !== window && (e.target.tagName === 'IMG' || e.target.tagName === 'SCRIPT' || e.target.tagName === 'LINK')) {
        addEntry({
          type: 'resource_error',
          tag: e.target.tagName.toLowerCase(),
          url: e.target.src || e.target.href || '',
          message: `Failed to load ${e.target.tagName.toLowerCase()} element`,
          timestamp: Date.now()
        });
      }
    }, true);
  }

  function addEntry(entry) {
    // Avoid duplicate rapid-fire logs
    const isDuplicate = errorLog.some(existing => 
      existing.type === entry.type &&
      existing.message === entry.message &&
      Math.abs((existing.timestamp || 0) - (entry.timestamp || 0)) < 500
    );

    if (!isDuplicate) {
      errorLog.push(entry);
      if (errorLog.length > MAX_LOGS) {
        errorLog.shift();
      }
    }
  }

  return {
    init,
    getErrors() {
      return [...errorLog];
    },
    getErrorsSince(timestamp) {
      return errorLog.filter(e => (e.timestamp || 0) >= timestamp);
    },
    clear() {
      errorLog.length = 0;
    }
  };
})();

// Initialize early
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => WebCheckErrorMonitor.init());
  } else {
    WebCheckErrorMonitor.init();
  }
}
