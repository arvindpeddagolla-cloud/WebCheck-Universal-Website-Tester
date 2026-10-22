/**
 * WebCheck — Safe Interactive Testing Engine
 * Tests interactive elements by safely triggering events, observing
 * DOM mutations, URL changes, and runtime errors with consequence guards.
 */

const WebCheckInteractionTester = (function () {
  const SENSITIVE_KEYWORDS = [
    'delete', 'remove', 'destroy', 'clear all', 'drop', 'terminate', 'purge',
    'buy', 'pay', 'purchase', 'order', 'checkout', 'charge', 'subscribe',
    'logout', 'log out', 'sign out', 'disconnect',
    'transfer', 'send message', 'submit order', 'transfer funds'
  ];

  /**
   * Determine if element activation could have irreversible or high-consequence side effects.
   * @param {Element} el 
   * @returns {Object} { isSensitive: boolean, reason: string }
   */
  function checkSafety(el) {
    if (!el) return { isSensitive: false };

    const textContent = (el.textContent || '').toLowerCase();
    const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
    const idAndClass = ((el.id || '') + ' ' + (el.className || '')).toLowerCase();
    const combinedText = `${textContent} ${ariaLabel} ${idAndClass}`;

    for (const kw of SENSITIVE_KEYWORDS) {
      if (combinedText.includes(kw)) {
        return {
          isSensitive: true,
          keyword: kw,
          reason: `Matches sensitive keyword "${kw}". Potentially destructive, transactional, or session-terminating.`
        };
      }
    }

    // Check if inside a checkout or payment form
    const parentForm = el.closest('form');
    if (parentForm) {
      const formText = ((parentForm.action || '') + ' ' + (parentForm.id || '') + ' ' + (parentForm.className || '')).toLowerCase();
      if (formText.includes('payment') || formText.includes('checkout') || formText.includes('billing')) {
        return {
          isSensitive: true,
          keyword: 'billing/payment form',
          reason: 'Element resides inside a payment or checkout form.'
        };
      }
    }

    return { isSensitive: false };
  }

  /**
   * Test a single element with observation window and consequence checking.
   * @param {string} webcheckId 
   * @param {Object} options { allowConsequential: boolean, observationMs: number }
   * @returns {Promise<Object>} Diagnostic finding
   */
  async function testElement(webcheckId, options = {}) {
    const el = WebCheckScanner.getElementById(webcheckId);
    if (!el) {
      return {
        webcheckId,
        status: 'ISSUE DETECTED',
        severity: 'HIGH',
        observedEvidence: `Element with diagnostic ID ${webcheckId} no longer found in current DOM.`,
        explanation: 'Element may have been detached, re-rendered, or unmounted by the framework.',
        suggestedFix: 'Rescan the page to refresh element references.'
      };
    }

    const safety = checkSafety(el);
    if (safety.isSensitive && !options.allowConsequential) {
      return {
        webcheckId,
        category: 'Safety & Consequence',
        elementType: el.tagName,
        elementLabel: el.textContent?.trim().slice(0, 50) || el.tagName,
        selector: el.tagName.toLowerCase(),
        testPerformed: 'Consequential Interaction Guard',
        status: 'NOT TESTED',
        severity: 'LOW',
        requiresConfirmation: true,
        keyword: safety.keyword,
        observedEvidence: `Activation blocked: ${safety.reason}`,
        explanation: 'WebCheck prevents automated execution of actions that may modify data, process payments, or invalidate sessions without explicit approval.',
        suggestedFix: 'Authorize interactive testing for this specific element with explicit approval in the report dialog.'
      };
    }

    const startTime = Date.now();
    const initialUrl = window.location.href;
    const initialHash = window.location.hash;

    // Track DOM mutations during interaction
    const mutations = [];
    let modalOpened = false;
    let spinnerDetected = false;

    const observer = new MutationObserver((mutationList) => {
      for (const m of mutationList) {
        mutations.push({
          type: m.type,
          targetTag: m.target.nodeName,
          attributeName: m.attributeName
        });

        // Check if a modal or dialog was opened
        if (m.type === 'childList') {
          m.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const tag = node.nodeName.toLowerCase();
              const role = node.getAttribute ? node.getAttribute('role') : '';
              if (tag === 'dialog' || role === 'dialog' || node.classList.contains('modal') || node.classList.contains('dialog')) {
                modalOpened = true;
              }
              if (node.classList.contains('spinner') || node.classList.contains('loading') || node.getAttribute?.('aria-busy') === 'true') {
                spinnerDetected = true;
              }
            }
          });
        }
        if (m.type === 'attributes') {
          const attr = m.attributeName;
          if (attr === 'aria-expanded' && m.target.getAttribute('aria-expanded') === 'true') {
            modalOpened = true;
          }
          if (attr === 'open' && m.target.hasAttribute('open')) {
            modalOpened = true;
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true
    });

    let clickError = null;

    // Safely dispatch interaction
    try {
      el.focus();
      // Dispatch standard synthetic click event
      const clickEvent = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true
      });
      el.dispatchEvent(clickEvent);
    } catch (err) {
      clickError = err;
    }

    const observationTime = options.observationMs || 800;
    await new Promise(resolve => setTimeout(resolve, observationTime));

    observer.disconnect();

    // Check runtime errors captured during interaction
    const errorsDuringTest = (typeof WebCheckErrorMonitor !== 'undefined')
      ? WebCheckErrorMonitor.getErrorsSince(startTime)
      : [];

    const urlChanged = window.location.href !== initialUrl || window.location.hash !== initialHash;

    const label = el.textContent?.trim().slice(0, 60) || el.getAttribute('aria-label') || el.tagName;

    // 1. If JavaScript runtime error was thrown
    if (clickError || errorsDuringTest.some(e => e.type === 'javascript_error' || e.type === 'unhandled_rejection')) {
      const err = clickError || errorsDuringTest.find(e => e.type === 'javascript_error' || e.type === 'unhandled_rejection');
      return {
        webcheckId,
        category: 'Interactive Test',
        elementType: el.tagName,
        elementLabel: label,
        selector: el.tagName.toLowerCase(),
        testPerformed: 'Event Activation & Error Monitoring',
        status: 'ISSUE DETECTED',
        severity: 'CRITICAL',
        observedEvidence: `JavaScript exception thrown during interaction: "${err.message || 'Error occurred'}"`,
        explanation: 'Activating this element triggered an uncaught JavaScript runtime error or unhandled promise rejection.',
        suggestedFix: 'Review the click handler or component callback for null references, undefined variables, or unhandled asynchronous exceptions.',
        attributes: { error: err.message, stack: err.stack }
      };
    }

    // 2. If network request failed during interaction
    const networkFail = errorsDuringTest.find(e => e.type === 'failed_request');
    if (networkFail) {
      return {
        webcheckId,
        category: 'Interactive Test',
        elementType: el.tagName,
        elementLabel: label,
        selector: el.tagName.toLowerCase(),
        testPerformed: 'Event Activation & Network Response',
        status: 'ISSUE DETECTED',
        severity: 'HIGH',
        observedEvidence: `HTTP Request to "${networkFail.url}" failed with HTTP ${networkFail.status} (${networkFail.statusText}).`,
        explanation: 'Triggering this element caused a client-side fetch or XHR request that returned a server or network failure.',
        suggestedFix: 'Verify the API endpoint URL, HTTP method, and server route handling.',
        attributes: { networkFail }
      };
    }

    // 3. If navigation or route change observed
    if (urlChanged) {
      return {
        webcheckId,
        category: 'Interactive Test',
        elementType: el.tagName,
        elementLabel: label,
        selector: el.tagName.toLowerCase(),
        testPerformed: 'Interactive Route / Navigation Response',
        status: 'PASS',
        severity: 'INFO',
        observedEvidence: `Navigation change observed: URL changed from ${initialUrl} to ${window.location.href}.`,
        explanation: 'Element triggered client-side route navigation or hash update successfully.',
        suggestedFix: 'No action required.',
        attributes: { newUrl: window.location.href }
      };
    }

    // 4. If observable DOM change occurred (modal, counter, content update)
    if (mutations.length > 0) {
      let detail = `${mutations.length} DOM mutations observed`;
      if (modalOpened) detail += ' (Modal or expandable content opened)';
      if (spinnerDetected) detail += ' (Loading state triggered)';

      return {
        webcheckId,
        category: 'Interactive Test',
        elementType: el.tagName,
        elementLabel: label,
        selector: el.tagName.toLowerCase(),
        testPerformed: 'Interactive DOM Mutation Response',
        status: 'PASS',
        severity: 'INFO',
        observedEvidence: `Observable response detected: ${detail}.`,
        explanation: 'Activating the control produced visible DOM or state changes without runtime errors.',
        suggestedFix: 'No action required.',
        attributes: { mutationCount: mutations.length, modalOpened }
      };
    }

    // 5. Inconclusive: No error, but no DOM change, no URL change, no network call
    return {
      webcheckId,
      category: 'Interactive Test',
      elementType: el.tagName,
      elementLabel: label,
      selector: el.tagName.toLowerCase(),
      testPerformed: 'Observable Button Response Verification',
      status: 'NEEDS REVIEW',
      severity: 'LOW',
      observedEvidence: 'The approved test did not observe a navigation change, network call, or relevant DOM change within the configured observation period.',
      explanation: 'The action may not have responded, or it may require additional input, prerequisite form fields, or specific application state.',
      suggestedFix: 'Inspect the event handler, application state, and relevant network requests.',
      attributes: { mutations: 0, urlChanged: false }
    };
  }

  /**
   * Run interactive tests across all safe interactive elements on the page.
   * Consequential elements are reported as NOT TESTED (Safety Guard).
   * @param {Array<string>} webcheckIds 
   * @param {Function} progressCallback 
   * @returns {Promise<Array<Object>>}
   */
  async function runBatchTests(webcheckIds, progressCallback) {
    const results = [];
    const total = webcheckIds.length;

    for (let i = 0; i < total; i++) {
      const id = webcheckIds[i];
      if (typeof progressCallback === 'function') {
        progressCallback({ current: i + 1, total, currentId: id });
      }

      const finding = await testElement(id, { allowConsequential: false, observationMs: 400 });
      results.push(finding);
      // Small pause between interactions to avoid browser throttle
      await new Promise(r => setTimeout(r, 100));
    }

    return results;
  }

  return {
    checkSafety,
    testElement,
    runBatchTests
  };
})();
