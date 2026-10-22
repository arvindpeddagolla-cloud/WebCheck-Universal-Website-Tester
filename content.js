/**
 * WebCheck — Content Script Coordinator
 * Listens to extension messages, runs scans, executes tests,
 * and provides smooth DOM element highlighting overlays.
 */

(function () {
  let activeHighlightOverlay = null;

  function clearHighlight() {
    if (activeHighlightOverlay && activeHighlightOverlay.parentNode) {
      activeHighlightOverlay.parentNode.removeChild(activeHighlightOverlay);
    }
    activeHighlightOverlay = null;
    const oldRings = document.querySelectorAll('.__webcheck_highlight_ring__');
    oldRings.forEach(r => r.classList.remove('__webcheck_highlight_ring__'));
  }

  function highlightElement(webcheckId, severity = 'HIGH', label = '') {
    clearHighlight();
    const el = WebCheckScanner.getElementById(webcheckId);
    if (!el) return false;

    // Scroll into view
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

    // Ensure CSS styles for highlight are injected
    if (!document.getElementById('__webcheck_highlight_styles__')) {
      const style = document.createElement('style');
      style.id = '__webcheck_highlight_styles__';
      style.textContent = `
        @keyframes webcheckPulse {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
          70% { box-shadow: 0 0 0 12px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        @keyframes webcheckPulseRed {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.8); }
          70% { box-shadow: 0 0 0 14px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        .__webcheck_highlight_ring__ {
          outline: 3px solid #10b981 !important;
          outline-offset: 3px !important;
          animation: webcheckPulse 2s infinite !important;
          border-radius: 4px !important;
        }
        .__webcheck_highlight_ring__.ring-critical,
        .__webcheck_highlight_ring__.ring-high {
          outline-color: #ef4444 !important;
          animation: webcheckPulseRed 2s infinite !important;
        }
        .__webcheck_highlight_ring__.ring-medium {
          outline-color: #f59e0b !important;
        }
        .__webcheck_floating_badge__ {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 2147483647;
          background: #0f172a;
          color: #f8fafc;
          border: 1px solid #334155;
          border-left: 5px solid #10b981;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
          border-radius: 8px;
          padding: 12px 16px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-size: 13px;
          line-height: 1.4;
          display: flex;
          align-items: center;
          gap: 12px;
          max-width: 420px;
          animation: webcheckSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .__webcheck_floating_badge__.badge-critical,
        .__webcheck_floating_badge__.badge-high {
          border-left-color: #ef4444;
        }
        .__webcheck_floating_badge__.badge-medium {
          border-left-color: #f59e0b;
        }
        @keyframes webcheckSlideUp {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `;
      (document.head || document.documentElement).appendChild(style);
    }

    const sevClass = `ring-${(severity || 'HIGH').toLowerCase()}`;
    el.classList.add('__webcheck_highlight_ring__', sevClass);

    // Create floating badge on bottom-right of viewport
    const badge = document.createElement('div');
    badge.className = `__webcheck_floating_badge__ badge-${(severity || 'HIGH').toLowerCase()}`;
    badge.innerHTML = `
      <div style="flex: 1;">
        <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 2px;">
          WebCheck Inspector
        </div>
        <div style="font-weight: 600; color: #f8fafc; word-break: break-all;">
          ${escapeHtml(label || webcheckId)}
        </div>
        <div style="font-size: 11px; color: #cbd5e1; margin-top: 2px;">
          Diagnostic ID: <code>${escapeHtml(webcheckId)}</code>
        </div>
      </div>
      <button id="__webcheck_close_badge__" style="background: transparent; border: none; color: #94a3b8; cursor: pointer; padding: 4px; border-radius: 4px; display: flex; align-items: center; justify-content: center;" title="Dismiss highlight">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    `;

    document.body.appendChild(badge);
    activeHighlightOverlay = badge;

    const closeBtn = badge.querySelector('#__webcheck_close_badge__');
    if (closeBtn) {
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        clearHighlight();
      };
    }

    // Auto dismiss after 10 seconds
    setTimeout(() => {
      if (activeHighlightOverlay === badge) {
        clearHighlight();
      }
    }, 10000);

    return true;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Chrome Runtime Message Listener
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'GET_PAGE_INFO') {
      sendResponse({
        url: window.location.href,
        hostname: window.location.hostname || 'localhost',
        title: document.title,
        readyState: document.readyState
      });
      return false;
    }

    if (message.action === 'START_SCAN') {
      WebCheckScanner.runScan(message.options || {})
        .then(scanReport => sendResponse({ success: true, report: scanReport }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true; // Keep channel open for async response
    }

    if (message.action === 'RUN_INTERACTION_TEST') {
      WebCheckInteractionTester.testElement(message.webcheckId, message.options || {})
        .then(result => sendResponse({ success: true, result }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    }

    if (message.action === 'HIGHLIGHT_ELEMENT') {
      const ok = highlightElement(message.webcheckId, message.severity, message.label);
      sendResponse({ success: ok });
      return false;
    }

    if (message.action === 'CLEAR_HIGHLIGHT') {
      clearHighlight();
      sendResponse({ success: true });
      return false;
    }
  });
})();
