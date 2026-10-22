/**
 * WebCheck — Dynamic DOM Inspection & Safe Diagnostic Engine
 * Analyzes buttons, links, forms, inputs, images, dialogs, tabs,
 * and collects runtime errors deterministically without altering page state.
 */

const WebCheckScanner = (function () {
  let elementCounter = 0;
  const elementRegistry = new Map();

  function resetRegistry() {
    elementCounter = 0;
    elementRegistry.clear();
  }

  function assignDiagnosticId(el, typePrefix = 'elem') {
    let id = el.getAttribute('data-webcheck-id');
    if (!id) {
      elementCounter++;
      id = `wc-${typePrefix}-${elementCounter}`;
      el.setAttribute('data-webcheck-id', id);
    }
    elementRegistry.set(id, el);
    return id;
  }

  function getElementLabel(el) {
    if (!el) return 'Unknown Element';
    // 1. aria-label
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();

    // 2. aria-labelledby
    const ariaLabelledBy = el.getAttribute('aria-labelledby');
    if (ariaLabelledBy) {
      const target = document.getElementById(ariaLabelledBy);
      if (target && target.textContent && target.textContent.trim()) {
        return target.textContent.trim().slice(0, 80);
      }
    }

    // 3. title or placeholder
    if (el.title && el.title.trim()) return el.title.trim();
    if (el.placeholder && el.placeholder.trim()) return `Placeholder: "${el.placeholder.trim()}"`;

    // 4. Form inputs associated with <label>
    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label && label.textContent && label.textContent.trim()) {
        return label.textContent.trim().slice(0, 80);
      }
    }
    const parentLabel = el.closest('label');
    if (parentLabel && parentLabel.textContent && parentLabel.textContent.trim()) {
      return parentLabel.textContent.trim().slice(0, 80);
    }

    // 5. Text content or value
    if (el.value && typeof el.value === 'string' && el.value.trim() && el.type !== 'password') {
      return el.value.trim().slice(0, 80);
    }
    if (el.textContent && el.textContent.trim()) {
      return el.textContent.trim().replace(/\s+/g, ' ').slice(0, 80);
    }

    // 6. Alt attribute for images
    if (el.alt && el.alt.trim()) return `Alt: "${el.alt.trim()}"`;

    return el.tagName.toLowerCase();
  }

  function getCssSelector(el) {
    if (!(el instanceof Element)) return '';
    const path = [];
    while (el && el.nodeType === Node.ELEMENT_NODE) {
      let selector = el.nodeName.toLowerCase();
      if (el.id) {
        selector += '#' + CSS.escape(el.id);
        path.unshift(selector);
        break;
      } else {
        let sib = el, nth = 1;
        while ((sib = sib.previousElementSibling)) {
          if (sib.nodeName.toLowerCase() === selector) nth++;
        }
        if (nth !== 1) selector += `:nth-of-type(${nth})`;
      }
      path.unshift(selector);
      el = el.parentNode;
    }
    return path.join(' > ');
  }

  function getHtmlSnippet(el) {
    if (!el) return '';
    const clone = el.cloneNode(false);
    let html = clone.outerHTML;
    if (el.childNodes.length > 0) {
      const text = el.textContent ? el.textContent.trim().replace(/\s+/g, ' ') : '';
      if (text.length > 0) {
        const shortText = text.length > 40 ? text.slice(0, 40) + '...' : text;
        html = html.replace('></', `>${shortText}</`);
      }
    }
    return html.length > 250 ? html.slice(0, 250) + '...' : html;
  }

  function isElementVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  /**
   * Main scan routine.
   * @param {Object} options 
   * @returns {Promise<Object>} Complete diagnostic report
   */
  async function runScan(options = {}) {
    resetRegistry();
    const findings = [];
    let checksPerformed = 0;
    const discoveredElementsSet = new Set();

    const startTime = Date.now();
    const pageUrl = window.location.href;
    const hostname = window.location.hostname || 'localhost';

    // 1. RUNTIME & CONSOLE TELEMETRY CHECK
    checksPerformed++;
    const runtimeErrors = (typeof WebCheckErrorMonitor !== 'undefined') ? WebCheckErrorMonitor.getErrors() : [];
    if (runtimeErrors.length > 0) {
      runtimeErrors.forEach((err, idx) => {
        let severity = 'HIGH';
        let category = 'Runtime & Network';
        let explanation = 'An error occurred during page execution.';
        let suggestedFix = 'Inspect developer console, stack trace, and error boundary.';

        if (err.type === 'javascript_error') {
          severity = 'CRITICAL';
          explanation = `Uncaught script error occurred at ${err.filename || 'unknown'}:${err.lineno || 0}`;
          suggestedFix = 'Review the source code where this exception was thrown and add defensive error handling or try/catch blocks.';
        } else if (err.type === 'unhandled_rejection') {
          severity = 'HIGH';
          explanation = 'A Promise rejected without a .catch() handler or error boundary.';
          suggestedFix = 'Ensure all async operations and Promises have explicit error rejection handlers.';
        } else if (err.type === 'failed_request') {
          severity = 'HIGH';
          explanation = `Network request to ${err.url} failed with status code ${err.status} (${err.statusText}).`;
          suggestedFix = 'Verify the server route exists, API server is running, and correct authentication/CORS headers are returned.';
        } else if (err.type === 'resource_error') {
          severity = 'MEDIUM';
          explanation = `Static resource (${err.tag}) at ${err.url || 'relative path'} failed to load.`;
          suggestedFix = 'Check if the file asset exists in the build output and asset path is valid.';
        }

        findings.push({
          id: `finding-err-${idx + 1}`,
          webcheckId: 'wc-runtime-env',
          category: category,
          elementType: err.type.toUpperCase(),
          elementLabel: err.message || `${err.type}: ${err.url || ''}`,
          selector: 'window',
          testPerformed: 'Observable Runtime & Network Errors',
          status: 'ISSUE DETECTED',
          severity: severity,
          observedEvidence: `${err.type.toUpperCase()}: ${err.message || err.statusText || ''} | URL: ${err.url || err.filename || 'N/A'}`,
          explanation: explanation,
          suggestedFix: suggestedFix,
          attributes: err,
          outerHtmlSnippet: err.stack ? err.stack.slice(0, 200) : ''
        });
      });
    } else {
      findings.push({
        id: 'finding-err-pass',
        webcheckId: 'wc-runtime-env',
        category: 'Runtime & Network',
        elementType: 'WINDOW',
        elementLabel: 'Global Page Runtime Context',
        selector: 'window',
        testPerformed: 'Observable Runtime & Network Errors',
        status: 'PASS',
        severity: 'INFO',
        observedEvidence: 'Zero uncaught JavaScript exceptions, unhandled rejections, or 4xx/5xx network failures observed.',
        explanation: 'Page loaded cleanly without triggering observable global runtime errors.',
        suggestedFix: 'Continue monitoring during interactive testing.',
        attributes: {},
        outerHtmlSnippet: ''
      });
    }

    // 2. BUTTONS & CLICKABLE CONTROLS INSPECTION
    const buttons = Array.from(document.querySelectorAll(
      'button, input[type="button"], input[type="submit"], input[type="reset"], [role="button"], a[role="button"]'
    ));

    // Also detect divs/spans styled as clickable (cursor: pointer) with onclick or interaction handlers
    const pseudoClickables = Array.from(document.querySelectorAll('div, span, i, svg, li, a:not([href])')).filter(el => {
      if (buttons.includes(el)) return false;
      const style = window.getComputedStyle(el);
      const isPointer = style.cursor === 'pointer';
      const hasOnClick = el.hasAttribute('onclick') || el.hasAttribute('tabindex');
      return isPointer && hasOnClick;
    });

    const allClickables = [...buttons, ...pseudoClickables];

    for (const btn of allClickables) {
      const wcId = assignDiagnosticId(btn, 'btn');
      discoveredElementsSet.add(wcId);
      const label = getElementLabel(btn);
      const selector = getCssSelector(btn);
      const snippet = getHtmlSnippet(btn);
      const isDisabled = btn.disabled || btn.getAttribute('aria-disabled') === 'true' || btn.classList.contains('disabled');
      const isSemanticButton = btn.tagName === 'BUTTON' || (btn.tagName === 'INPUT' && ['button', 'submit', 'reset'].includes(btn.type));
      const hasTabIndex = btn.hasAttribute('tabindex');

      // Check 2.1: Accessible Name
      checksPerformed++;
      if (!label || label === btn.tagName.toLowerCase()) {
        findings.push({
          id: `finding-${findings.length + 1}`,
          webcheckId: wcId,
          category: 'Buttons & Controls',
          elementType: btn.tagName,
          elementLabel: 'Unlabelled Button',
          selector,
          testPerformed: 'Accessible Name Inspection',
          status: 'ISSUE DETECTED',
          severity: 'HIGH',
          observedEvidence: 'Button has no visible text content, aria-label, aria-labelledby, or title attribute.',
          explanation: 'Interactive buttons without accessible names cannot be interpreted by screen readers or speech navigation tools.',
          suggestedFix: 'Add descriptive text inside the button or provide an aria-label attribute (e.g. aria-label="Close dialog").',
          attributes: { tagName: btn.tagName, disabled: isDisabled },
          outerHtmlSnippet: snippet
        });
      } else {
        findings.push({
          id: `finding-${findings.length + 1}`,
          webcheckId: wcId,
          category: 'Buttons & Controls',
          elementType: btn.tagName,
          elementLabel: label,
          selector,
          testPerformed: 'Accessible Name Inspection',
          status: 'PASS',
          severity: 'INFO',
          observedEvidence: `Button possesses accessible label: "${label}".`,
          explanation: 'Button is appropriately labelled for assistive technology and keyboard navigation.',
          suggestedFix: 'No action required.',
          attributes: { label, tagName: btn.tagName },
          outerHtmlSnippet: snippet
        });
      }

      // Check 2.2: Keyboard focusability on non-semantic buttons
      if (!isSemanticButton) {
        checksPerformed++;
        if (!hasTabIndex || btn.getAttribute('tabindex') === '-1') {
          findings.push({
            id: `finding-${findings.length + 1}`,
            webcheckId: wcId,
            category: 'Accessibility',
            elementType: btn.tagName,
            elementLabel: label,
            selector,
            testPerformed: 'Keyboard Focusability & Semantics',
            status: 'ISSUE DETECTED',
            severity: 'MEDIUM',
            observedEvidence: `Element <${btn.tagName.toLowerCase()}> is styled as clickable or assigned role="button" but lacks tabindex="0".`,
            explanation: 'Keyboard users cannot reach this interactive control via the Tab key.',
            suggestedFix: 'Prefer native <button> elements. If using a custom element, add tabindex="0" and handle Enter/Space keydown events.',
            attributes: { role: btn.getAttribute('role'), tabindex: btn.getAttribute('tabindex') },
            outerHtmlSnippet: snippet
          });
        }
      }

      // Check 2.3: Disabled Control State
      checksPerformed++;
      if (isDisabled) {
        findings.push({
          id: `finding-${findings.length + 1}`,
          webcheckId: wcId,
          category: 'Buttons & Controls',
          elementType: btn.tagName,
          elementLabel: label,
          selector,
          testPerformed: 'Element State & Availability',
          status: 'PASS',
          severity: 'INFO',
          observedEvidence: `Control is disabled (disabled="${btn.disabled}", aria-disabled="${btn.getAttribute('aria-disabled')}").`,
          explanation: 'Control is currently inactive. This is normal for forms awaiting valid input or permissions.',
          suggestedFix: 'Verify conditional enablement logic activates this button when required conditions are satisfied.',
          attributes: { disabled: true },
          outerHtmlSnippet: snippet
        });
      }

      // Check 2.4: Safe Interaction Readiness
      checksPerformed++;
      // Check for destructive action keywords
      const sensitiveKeywords = ['delete', 'remove', 'destroy', 'terminate', 'purge', 'drop', 'buy', 'pay', 'purchase', 'order', 'checkout', 'logout', 'sign out'];
      const textLower = (label + ' ' + (btn.className || '') + ' ' + (btn.id || '')).toLowerCase();
      const isConsequential = sensitiveKeywords.some(kw => textLower.includes(kw));

      if (isConsequential) {
        findings.push({
          id: `finding-${findings.length + 1}`,
          webcheckId: wcId,
          category: 'Safety & Consequence',
          elementType: btn.tagName,
          elementLabel: label,
          selector,
          testPerformed: 'Consequential Action Guard',
          status: 'NOT TESTED',
          severity: 'LOW',
          observedEvidence: `Action matches sensitive keywords: "${label}". Automatic activation prohibited.`,
          explanation: 'This action may permanently modify data, process payments, or invalidate user sessions.',
          suggestedFix: 'Test this control manually or use Interactive Test mode with explicit authorization.',
          attributes: { consequential: true },
          outerHtmlSnippet: snippet
        });
      } else if (!isDisabled) {
        findings.push({
          id: `finding-${findings.length + 1}`,
          webcheckId: wcId,
          category: 'Buttons & Controls',
          elementType: btn.tagName,
          elementLabel: label,
          selector,
          testPerformed: 'Event Handler & Response Readiness',
          status: 'NEEDS REVIEW',
          severity: 'LOW',
          observedEvidence: 'Element structure is valid. In modern frameworks, event listeners are attached in JavaScript rather than inline HTML.',
          explanation: 'Safe scan does not trigger arbitrary clicks. Use Interactive Test mode to verify whether this button produces DOM changes, routes, or modal responses.',
          suggestedFix: 'Run an Interactive Test on this element to observe runtime DOM mutations or route changes.',
          attributes: { isInteractiveCandidate: true },
          outerHtmlSnippet: snippet
        });
      }
    }

    // 3. LINKS & NAVIGATION INSPECTION
    const links = Array.from(document.querySelectorAll('a, area, [role="link"]'));

    for (const link of links) {
      const wcId = assignDiagnosticId(link, 'link');
      discoveredElementsSet.add(wcId);
      const label = getElementLabel(link);
      const selector = getCssSelector(link);
      const snippet = getHtmlSnippet(link);
      const href = link.getAttribute('href');

      // Check 3.1: Missing or Empty href
      checksPerformed++;
      if (href === null) {
        findings.push({
          id: `finding-${findings.length + 1}`,
          webcheckId: wcId,
          category: 'Links & Navigation',
          elementType: 'A',
          elementLabel: label,
          selector,
          testPerformed: 'Link Destination Inspection',
          status: 'ISSUE DETECTED',
          severity: 'MEDIUM',
          observedEvidence: 'Anchor element <a> does not have an href attribute.',
          explanation: 'Links without href attributes do not function as navigable hypertext links and are not keyboard accessible by default.',
          suggestedFix: 'Add a valid destination href, or if this triggers a JavaScript action, use a semantic <button> instead.',
          attributes: { href: null },
          outerHtmlSnippet: snippet
        });
        continue;
      }

      const trimmedHref = href.trim();

      // Check 3.2: Placeholder or empty destinations
      checksPerformed++;
      if (trimmedHref === '' || trimmedHref === '#' || trimmedHref.toLowerCase().startsWith('javascript:void(0)')) {
        findings.push({
          id: `finding-${findings.length + 1}`,
          webcheckId: wcId,
          category: 'Links & Navigation',
          elementType: 'A',
          elementLabel: label,
          selector,
          testPerformed: 'Placeholder Destination Detection',
          status: 'ISSUE DETECTED',
          severity: 'MEDIUM',
          observedEvidence: `Link destination is placeholder: href="${trimmedHref}".`,
          explanation: 'Using href="#" or javascript:void(0) causes abrupt scroll jumps, breaks right-click "Open in New Tab", and violates navigation accessibility.',
          suggestedFix: 'Replace placeholder links with valid route URLs or convert to <button type="button"> for script-driven actions.',
          attributes: { href: trimmedHref },
          outerHtmlSnippet: snippet
        });
      } else {
        // Check 3.3: Link Accessible Text
        checksPerformed++;
        if (!label || label === link.tagName.toLowerCase()) {
          findings.push({
            id: `finding-${findings.length + 1}`,
            webcheckId: wcId,
            category: 'Accessibility',
            elementType: 'A',
            elementLabel: `Link to: ${trimmedHref.slice(0, 50)}`,
            selector,
            testPerformed: 'Link Accessible Name',
            status: 'ISSUE DETECTED',
            severity: 'HIGH',
            observedEvidence: 'Link contains no readable text, aria-label, or title.',
            explanation: 'Screen readers announce unlabelled links as "link" or read the raw URL, severely degrading accessibility.',
            suggestedFix: 'Include visible anchor text or an aria-label describing the destination.',
            attributes: { href: trimmedHref },
            outerHtmlSnippet: snippet
          });
        }

        // Check 3.4: External Links Security (rel="noopener")
        const target = link.getAttribute('target');
        if (target === '_blank') {
          checksPerformed++;
          const rel = (link.getAttribute('rel') || '').toLowerCase();
          if (!rel.includes('noopener') && !rel.includes('noreferrer')) {
            findings.push({
              id: `finding-${findings.length + 1}`,
              webcheckId: wcId,
              category: 'Security & Navigation',
              elementType: 'A',
              elementLabel: label,
              selector,
              testPerformed: 'Reverse Tabnabbing & Opener Protection',
              status: 'ISSUE DETECTED',
              severity: 'LOW',
              observedEvidence: 'target="_blank" link missing rel="noopener" attribute.',
              explanation: 'Opening links in a new window without rel="noopener" allows the target page to access window.opener and potentially redirect the original tab.',
              suggestedFix: 'Add rel="noopener noreferrer" to external links opening in a new tab.',
              attributes: { target, rel },
              outerHtmlSnippet: snippet
            });
          }
        }

        // Check 3.5: Internal Link Verification (HTTP 404 / 500 Check)
        // Safe check for relative routes or same-origin URLs
        checksPerformed++;
        const isRelativeOrSameOrigin = trimmedHref.startsWith('/') ||
          trimmedHref.startsWith('./') ||
          trimmedHref.startsWith('../') ||
          trimmedHref.startsWith(window.location.origin) ||
          (!trimmedHref.includes('://') && !trimmedHref.startsWith('mailto:') && !trimmedHref.startsWith('tel:'));

        if (isRelativeOrSameOrigin && !trimmedHref.startsWith('#')) {
          try {
            const resolvedUrl = new URL(trimmedHref, window.location.href).href;
            // Perform safe, non-navigating HEAD check with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1800);

            let fetchRes;
            try {
              fetchRes = await fetch(resolvedUrl, { method: 'HEAD', signal: controller.signal, cache: 'no-store' });
              clearTimeout(timeoutId);
            } catch (headErr) {
              clearTimeout(timeoutId);
              // In some servers HEAD is 405 Method Not Allowed; fallback to GET range
              if (headErr.name !== 'AbortError') {
                const getCtrl = new AbortController();
                const getTimer = setTimeout(() => getCtrl.abort(), 1800);
                try {
                  fetchRes = await fetch(resolvedUrl, {
                    method: 'GET',
                    headers: { 'Range': 'bytes=0-0' },
                    signal: getCtrl.signal
                  });
                } catch (_) { }
                clearTimeout(getTimer);
              }
            }

            if (fetchRes) {
              if (fetchRes.status === 404 || fetchRes.status === 500 || fetchRes.status >= 400) {
                findings.push({
                  id: `finding-${findings.length + 1}`,
                  webcheckId: wcId,
                  category: 'Links & Navigation',
                  elementType: 'A',
                  elementLabel: label,
                  selector,
                  testPerformed: 'Internal Route HTTP Health Check',
                  status: 'ISSUE DETECTED',
                  severity: 'HIGH',
                  observedEvidence: `Verified broken destination: ${resolvedUrl} returned HTTP ${fetchRes.status} ${fetchRes.statusText}.`,
                  explanation: 'Users following this link will encounter a broken page or server error.',
                  suggestedFix: 'Verify the target route, file path, or rewrite rule exists in your web server.',
                  attributes: { resolvedUrl, status: fetchRes.status },
                  outerHtmlSnippet: snippet
                });
              } else {
                findings.push({
                  id: `finding-${findings.length + 1}`,
                  webcheckId: wcId,
                  category: 'Links & Navigation',
                  elementType: 'A',
                  elementLabel: label,
                  selector,
                  testPerformed: 'Internal Route HTTP Health Check',
                  status: 'PASS',
                  severity: 'INFO',
                  observedEvidence: `Destination ${resolvedUrl} responded successfully (HTTP ${fetchRes.status}).`,
                  explanation: 'Internal link destination is active and reachable.',
                  suggestedFix: 'No action required.',
                  attributes: { resolvedUrl, status: fetchRes.status },
                  outerHtmlSnippet: snippet
                });
              }
            } else {
              findings.push({
                id: `finding-${findings.length + 1}`,
                webcheckId: wcId,
                category: 'Links & Navigation',
                elementType: 'A',
                elementLabel: label,
                selector,
                testPerformed: 'Internal Route HTTP Health Check',
                status: 'NEEDS REVIEW',
                severity: 'LOW',
                observedEvidence: `Could not verify ${resolvedUrl} synchronously (request timed out or aborted).`,
                explanation: 'Route could be managed entirely client-side via SPA router or server restricted HEAD requests.',
                suggestedFix: 'Manually test navigation to verify the client-side route renders properly.',
                attributes: { resolvedUrl },
                outerHtmlSnippet: snippet
              });
            }
          } catch (e) {
            // Malformed URL or error
            findings.push({
              id: `finding-${findings.length + 1}`,
              webcheckId: wcId,
              category: 'Links & Navigation',
              elementType: 'A',
              elementLabel: label,
              selector,
              testPerformed: 'URL Syntax & Parsing',
              status: 'ISSUE DETECTED',
              severity: 'HIGH',
              observedEvidence: `Invalid URL format: "${trimmedHref}". Parsing error: ${e.message}`,
              explanation: 'Malformed URLs fail to navigate or cause browser errors.',
              suggestedFix: 'Correct the href attribute syntax.',
              attributes: { href: trimmedHref },
              outerHtmlSnippet: snippet
            });
          }
        } else {
          // Cross origin link
          findings.push({
            id: `finding-${findings.length + 1}`,
            webcheckId: wcId,
            category: 'Links & Navigation',
            elementType: 'A',
            elementLabel: label,
            selector,
            testPerformed: 'Cross-Origin Link Health',
            status: 'NOT TESTED',
            severity: 'INFO',
            observedEvidence: `Cross-origin URL (${trimmedHref.slice(0, 45)}...) skipped during safe scan.`,
            explanation: 'Cross-origin requests are not inspected automatically to respect external domain boundaries and CORS.',
            suggestedFix: 'Click external link manually in a new tab to verify availability if desired.',
            attributes: { href: trimmedHref },
            outerHtmlSnippet: snippet
          });
        }
      }
    }

    // 4. FORMS & INPUTS INSPECTION
    const forms = Array.from(document.querySelectorAll('form'));
    for (const form of forms) {
      const wcId = assignDiagnosticId(form, 'form');
      discoveredElementsSet.add(wcId);
      const selector = getCssSelector(form);
      const snippet = getHtmlSnippet(form);
      const action = form.getAttribute('action');
      const submitBtn = form.querySelector('button[type="submit"], input[type="submit"], button:not([type])');

      // Check 4.1: Submit Button Presence
      checksPerformed++;
      if (!submitBtn) {
        findings.push({
          id: `finding-${findings.length + 1}`,
          webcheckId: wcId,
          category: 'Forms & Inputs',
          elementType: 'FORM',
          elementLabel: form.id ? `Form #${form.id}` : 'Form',
          selector,
          testPerformed: 'Form Submit Mechanism',
          status: 'NEEDS REVIEW',
          severity: 'MEDIUM',
          observedEvidence: 'Form element contains no explicit <button type="submit"> or <input type="submit">.',
          explanation: 'Forms without a submit button can cause submission failures on mobile keyboards and assistive technology.',
          suggestedFix: 'Include an explicit <button type="submit"> within the form.',
          attributes: { hasSubmit: false },
          outerHtmlSnippet: snippet
        });
      }

      // Check 4.2: Action Configuration
      checksPerformed++;
      if (!action || action.trim() === '') {
        findings.push({
          id: `finding-${findings.length + 1}`,
          webcheckId: wcId,
          category: 'Forms & Inputs',
          elementType: 'FORM',
          elementLabel: form.id ? `Form #${form.id}` : 'Form',
          selector,
          testPerformed: 'Form Action Configuration',
          status: 'NEEDS REVIEW',
          severity: 'LOW',
          observedEvidence: 'Form has no action attribute defined.',
          explanation: 'Standard HTML forms default to refreshing the current page without an action attribute, unless intercepted by a framework onSubmit handler.',
          suggestedFix: 'Verify client-side JavaScript attaches e.preventDefault() in an onSubmit listener, or provide an action endpoint.',
          attributes: { action: null },
          outerHtmlSnippet: snippet
        });
      }
    }

    const formControls = Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea, select'));
    for (const input of formControls) {
      const wcId = assignDiagnosticId(input, 'input');
      discoveredElementsSet.add(wcId);
      const label = getElementLabel(input);
      const selector = getCssSelector(input);
      const snippet = getHtmlSnippet(input);
      const inputType = input.getAttribute('type') || (input.tagName === 'TEXTAREA' ? 'textarea' : 'text');
      const isRequired = input.required || input.getAttribute('aria-required') === 'true';

      // Check 4.3: Accessible Labeling
      checksPerformed++;
      const hasId = Boolean(input.id);
      const associatedLabel = hasId ? document.querySelector(`label[for="${CSS.escape(input.id)}"]`) : null;
      const parentLabel = input.closest('label');
      const ariaLabel = input.getAttribute('aria-label');
      const ariaLabelledBy = input.getAttribute('aria-labelledby');

      const isLabelled = associatedLabel || parentLabel || ariaLabel || ariaLabelledBy;

      if (!isLabelled) {
        findings.push({
          id: `finding-${findings.length + 1}`,
          webcheckId: wcId,
          category: 'Accessibility',
          elementType: input.tagName,
          elementLabel: `Unlabelled ${inputType} input`,
          selector,
          testPerformed: 'Form Control Label Association',
          status: 'ISSUE DETECTED',
          severity: 'HIGH',
          observedEvidence: `Input field <${input.tagName.toLowerCase()} type="${inputType}"> has no associated <label>, aria-label, or aria-labelledby.`,
          explanation: 'Form controls must have accessible labels so screen reader users understand what information is requested.',
          suggestedFix: 'Add a <label for="element-id"> or aria-label attribute to this input.',
          attributes: { inputType, isRequired },
          outerHtmlSnippet: snippet
        });
      } else {
        findings.push({
          id: `finding-${findings.length + 1}`,
          webcheckId: wcId,
          category: 'Forms & Inputs',
          elementType: input.tagName,
          elementLabel: label,
          selector,
          testPerformed: 'Form Control Label Association',
          status: 'PASS',
          severity: 'INFO',
          observedEvidence: `Input successfully associated with label "${label}".`,
          explanation: 'Input control satisfies accessible labeling criteria.',
          suggestedFix: 'No action required.',
          attributes: { inputType, label },
          outerHtmlSnippet: snippet
        });
      }

      // Check 4.4: Required Field Accessibility
      if (isRequired) {
        checksPerformed++;
        const hasAriaRequired = input.getAttribute('aria-required') === 'true';
        if (!hasAriaRequired) {
          findings.push({
            id: `finding-${findings.length + 1}`,
            webcheckId: wcId,
            category: 'Accessibility',
            elementType: input.tagName,
            elementLabel: label,
            selector,
            testPerformed: 'Required Field Indicator',
            status: 'NEEDS REVIEW',
            severity: 'LOW',
            observedEvidence: 'Input has HTML required attribute but is missing aria-required="true".',
            explanation: 'Some older screen readers better recognize aria-required="true" alongside native required.',
            suggestedFix: 'Ensure visible required indicators (e.g. *) are accompanied by clear instructions or aria-required="true".',
            attributes: { required: true },
            outerHtmlSnippet: snippet
          });
        }
      }

      // Check 4.5: Native Browser Validation Constraints
      checksPerformed++;
      if (typeof input.checkValidity === 'function') {
        const isValid = input.checkValidity();
        if (!isValid && input.value) {
          findings.push({
            id: `finding-${findings.length + 1}`,
            webcheckId: wcId,
            category: 'Forms & Inputs',
            elementType: input.tagName,
            elementLabel: label,
            selector,
            testPerformed: 'HTML5 Form Validation Constraints',
            status: 'ISSUE DETECTED',
            severity: 'MEDIUM',
            observedEvidence: `Input fails native validation: ${input.validationMessage || 'Constraint violation'} (current value: "${input.value.slice(0, 30)}").`,
            explanation: 'The current value of this control violates configured pattern, type, min/max, or step constraints.',
            suggestedFix: 'Inspect the validation attributes (type, pattern, min, max, step) or default pre-filled value.',
            attributes: { validationMessage: input.validationMessage },
            outerHtmlSnippet: snippet
          });
        } else {
          findings.push({
            id: `finding-${findings.length + 1}`,
            webcheckId: wcId,
            category: 'Forms & Inputs',
            elementType: input.tagName,
            elementLabel: label,
            selector,
            testPerformed: 'HTML5 Form Validation Constraints',
            status: 'PASS',
            severity: 'INFO',
            observedEvidence: 'Form control constraints are valid according to browser validation engine.',
            explanation: 'Control satisfies standard HTML5 validation rules.',
            suggestedFix: 'No action required.',
            attributes: { isValid: true },
            outerHtmlSnippet: snippet
          });
        }
      }
    }

    // 5. IMAGES & MEDIA INSPECTION
    const images = Array.from(document.querySelectorAll('img, svg, picture, [role="img"]'));
    for (const img of images) {
      const wcId = assignDiagnosticId(img, 'img');
      discoveredElementsSet.add(wcId);
      const label = getElementLabel(img);
      const selector = getCssSelector(img);
      const snippet = getHtmlSnippet(img);

      if (img.tagName === 'IMG') {
        const src = img.getAttribute('src');
        const alt = img.getAttribute('alt');

        // Check 5.1: Missing or Empty src
        checksPerformed++;
        if (!src || src.trim() === '' || src.trim() === '#') {
          findings.push({
            id: `finding-${findings.length + 1}`,
            webcheckId: wcId,
            category: 'Images & Media',
            elementType: 'IMG',
            elementLabel: label,
            selector,
            testPerformed: 'Image Source Verification',
            status: 'ISSUE DETECTED',
            severity: 'HIGH',
            observedEvidence: `Image has empty or placeholder src attribute: src="${src}".`,
            explanation: 'Images with empty or invalid sources trigger unnecessary 404 network requests and display broken image icons.',
            suggestedFix: 'Provide a valid image file path or remove the empty img element.',
            attributes: { src },
            outerHtmlSnippet: snippet
          });
        } else {
          // Check 5.2: Broken Image Load (naturalWidth === 0)
          checksPerformed++;
          if (img.complete && img.naturalWidth === 0) {
            findings.push({
              id: `finding-${findings.length + 1}`,
              webcheckId: wcId,
              category: 'Images & Media',
              elementType: 'IMG',
              elementLabel: label,
              selector,
              testPerformed: 'Image Load Integrity',
              status: 'ISSUE DETECTED',
              severity: 'HIGH',
              observedEvidence: `Image failed to load: naturalWidth is 0 (src="${src.slice(0, 80)}").`,
              explanation: 'The browser completed loading the image element, but the asset was missing, corrupt, or returned an HTTP error.',
              suggestedFix: 'Verify the file exists on the server, the URL path is correct, and permissions allow access.',
              attributes: { src, naturalWidth: 0 },
              outerHtmlSnippet: snippet
            });
          } else if (img.complete && img.naturalWidth > 0) {
            findings.push({
              id: `finding-${findings.length + 1}`,
              webcheckId: wcId,
              category: 'Images & Media',
              elementType: 'IMG',
              elementLabel: label,
              selector,
              testPerformed: 'Image Load Integrity',
              status: 'PASS',
              severity: 'INFO',
              observedEvidence: `Image loaded successfully (${img.naturalWidth}x${img.naturalHeight}px).`,
              explanation: 'Image asset was fetched and rendered by the browser.',
              suggestedFix: 'No action required.',
              attributes: { width: img.naturalWidth, height: img.naturalHeight },
              outerHtmlSnippet: snippet
            });
          } else {
            findings.push({
              id: `finding-${findings.length + 1}`,
              webcheckId: wcId,
              category: 'Images & Media',
              elementType: 'IMG',
              elementLabel: label,
              selector,
              testPerformed: 'Image Load Integrity',
              status: 'NEEDS REVIEW',
              severity: 'LOW',
              observedEvidence: 'Image is still in the process of loading.',
              explanation: 'The browser has not completed downloading this image asset.',
              suggestedFix: 'Wait for page resources to finish loading and rescan.',
              attributes: { complete: false },
              outerHtmlSnippet: snippet
            });
          }
        }

        // Check 5.3: Alt Attribute Accessibility
        checksPerformed++;
        if (alt === null) {
          findings.push({
            id: `finding-${findings.length + 1}`,
            webcheckId: wcId,
            category: 'Accessibility',
            elementType: 'IMG',
            elementLabel: label,
            selector,
            testPerformed: 'Image Alternative Text',
            status: 'ISSUE DETECTED',
            severity: 'MEDIUM',
            observedEvidence: 'Image is missing an alt attribute entirely.',
            explanation: 'Screen readers will read out the entire file URL when an alt attribute is omitted.',
            suggestedFix: 'Add alt="Descriptive text" for informative images, or alt="" if decorative.',
            attributes: { alt: null },
            outerHtmlSnippet: snippet
          });
        }
      }
    }

    // 6. DIALOGS, MODALS & TABS
    const modals = Array.from(document.querySelectorAll('dialog, [role="dialog"], [role="alertdialog"], [aria-modal="true"]'));
    for (const modal of modals) {
      const wcId = assignDiagnosticId(modal, 'modal');
      discoveredElementsSet.add(wcId);
      const label = getElementLabel(modal);
      const selector = getCssSelector(modal);
      const snippet = getHtmlSnippet(modal);
      const isVisible = isElementVisible(modal);

      checksPerformed++;
      const hasAccessibleLabel = modal.hasAttribute('aria-label') || modal.hasAttribute('aria-labelledby');
      if (!hasAccessibleLabel) {
        findings.push({
          id: `finding-${findings.length + 1}`,
          webcheckId: wcId,
          category: 'Dialogs & Modals',
          elementType: modal.tagName,
          elementLabel: label,
          selector,
          testPerformed: 'Modal Accessible Identification',
          status: 'ISSUE DETECTED',
          severity: 'MEDIUM',
          observedEvidence: 'Modal / Dialog element lacks aria-label or aria-labelledby.',
          explanation: 'Screen readers announce modals when opened; without a label, users cannot discern the dialog’s context.',
          suggestedFix: 'Add aria-labelledby pointing to the modal’s header title element.',
          attributes: { isVisible },
          outerHtmlSnippet: snippet
        });
      } else {
        findings.push({
          id: `finding-${findings.length + 1}`,
          webcheckId: wcId,
          category: 'Dialogs & Modals',
          elementType: modal.tagName,
          elementLabel: label,
          selector,
          testPerformed: 'Modal Accessible Identification',
          status: 'PASS',
          severity: 'INFO',
          observedEvidence: `Modal has accessible label "${label}". Visible: ${isVisible}.`,
          explanation: 'Dialog structure meets accessibility naming guidelines.',
          suggestedFix: 'No action required.',
          attributes: { isVisible },
          outerHtmlSnippet: snippet
        });
      }
    }

    const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
    for (const tab of tabs) {
      const wcId = assignDiagnosticId(tab, 'tab');
      discoveredElementsSet.add(wcId);
      const label = getElementLabel(tab);
      const selector = getCssSelector(tab);
      const snippet = getHtmlSnippet(tab);

      checksPerformed++;
      const hasSelected = tab.hasAttribute('aria-selected');
      const hasControls = tab.hasAttribute('aria-controls');

      if (!hasSelected) {
        findings.push({
          id: `finding-${findings.length + 1}`,
          webcheckId: wcId,
          category: 'Tabs & Navigation',
          elementType: tab.tagName,
          elementLabel: label,
          selector,
          testPerformed: 'Tab State Accessibility',
          status: 'ISSUE DETECTED',
          severity: 'MEDIUM',
          observedEvidence: 'Element with role="tab" lacks aria-selected attribute ("true" or "false").',
          explanation: 'Assistive tech needs aria-selected to announce whether a tab is currently active.',
          suggestedFix: 'Add aria-selected="true" on the active tab and aria-selected="false" on inactive tabs.',
          attributes: { role: 'tab' },
          outerHtmlSnippet: snippet
        });
      }
    }

    // 7. DISCOVER ADDITIONAL PAGES ON SAME ORIGIN (Coverage feature)
    const discoveredPages = new Set();
    links.forEach(l => {
      const h = l.getAttribute('href');
      if (h && !h.startsWith('#') && !h.startsWith('javascript:')) {
        try {
          const u = new URL(h, window.location.href);
          if (u.origin === window.location.origin && u.pathname !== window.location.pathname) {
            discoveredPages.add(u.pathname + u.search);
          }
        } catch (_) { }
      }
    });

    const endTime = Date.now();
    const durationMs = endTime - startTime;

    // Calculate metrics strictly
    const passedChecks = findings.filter(f => f.status === 'PASS').length;
    const issuesDetected = findings.filter(f => f.status === 'ISSUE DETECTED').length;
    const itemsRequiringReview = findings.filter(f => f.status === 'NEEDS REVIEW').length;
    const checksNotPerformed = findings.filter(f => f.status === 'NOT TESTED').length;

    const scanReport = {
      id: `scan-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      url: pageUrl,
      hostname: hostname,
      timestamp: startTime,
      durationMs: durationMs,
      mode: options.mode || 'safe_scan',
      summary: {
        elementsDiscovered: discoveredElementsSet.size,
        checksPerformed: checksPerformed,
        passedChecks: passedChecks,
        issuesDetected: issuesDetected,
        itemsRequiringReview: itemsRequiringReview,
        checksNotPerformed: checksNotPerformed
      },
      findings: findings,
      discoveredRoutes: Array.from(discoveredPages).slice(0, 30)
    };

    return scanReport;
  }

  function getElementById(id) {
    return elementRegistry.get(id) || document.querySelector(`[data-webcheck-id="${CSS.escape(id)}"]`);
  }

  return {
    runScan,
    getElementById
  };
})();
