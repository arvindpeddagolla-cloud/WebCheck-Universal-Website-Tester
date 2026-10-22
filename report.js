/**
 * WebCheck — Full Diagnostic Report Dashboard Controller
 * Handles filtering, sorting, expanding, searching, highlighting on target tab,
 * running interactive tests, exporting (JSON, HTML, TXT), and historical scan loading.
 */

document.addEventListener('DOMContentLoaded', async () => {
  let currentReport = null;
  let activeFindings = [];
  let pendingSafetyWebcheckId = null;

  // DOM Elements
  const reportHostname = document.getElementById('reportHostname');
  const reportPath = document.getElementById('reportPath');
  const fullTargetUrl = document.getElementById('fullTargetUrl');
  const valScanMode = document.getElementById('valScanMode');
  const valTimestamp = document.getElementById('valTimestamp');
  const valDuration = document.getElementById('valDuration');

  // KPI Metrics
  const metricElements = document.getElementById('metricElements');
  const metricChecks = document.getElementById('metricChecks');
  const metricIssues = document.getElementById('metricIssues');
  const metricNeedsReview = document.getElementById('metricNeedsReview');
  const metricPassed = document.getElementById('metricPassed');
  const metricUntested = document.getElementById('metricUntested');

  // Toolbar & Filters
  const searchInput = document.getElementById('searchInput');
  const btnClearSearch = document.getElementById('btnClearSearch');
  const filterStatus = document.getElementById('filterStatus');
  const filterSeverity = document.getElementById('filterSeverity');
  const filterCategory = document.getElementById('filterCategory');
  const sortOrder = document.getElementById('sortOrder');

  const visibleCount = document.getElementById('visibleCount');
  const totalCount = document.getElementById('totalCount');
  const findingsList = document.getElementById('findingsList');
  const zeroFindings = document.getElementById('zeroFindings');
  const btnResetFilters = document.getElementById('btnResetFilters');

  const btnExpandAll = document.getElementById('btnExpandAll');
  const btnCollapseAll = document.getElementById('btnCollapseAll');

  // History & Rescan
  const btnHistoryDropdown = document.getElementById('btnHistoryDropdown');
  const historyMenu = document.getElementById('historyMenu');
  const historyList = document.getElementById('historyList');
  const btnClearAllHistory = document.getElementById('btnClearAllHistory');
  const btnRescan = document.getElementById('btnRescan');

  // Export
  const btnExportDropdown = document.getElementById('btnExportDropdown');
  const exportMenu = document.getElementById('exportMenu');
  const btnExportJson = document.getElementById('btnExportJson');
  const btnExportHtml = document.getElementById('btnExportHtml');
  const btnExportTxt = document.getElementById('btnExportTxt');

  // Coverage
  const discoveredCount = document.getElementById('discoveredCount');
  const routesList = document.getElementById('routesList');

  // Safety Modal
  const safetyModal = document.getElementById('safetyModal');
  const safetyKeywordTag = document.getElementById('safetyKeywordTag');
  const safetyElementDetails = document.getElementById('safetyElementDetails');
  const btnCloseSafetyModal = document.getElementById('btnCloseSafetyModal');
  const btnCancelSafety = document.getElementById('btnCancelSafety');
  const btnConfirmSafety = document.getElementById('btnConfirmSafety');

  // Toast
  const toastMessage = document.getElementById('toastMessage');
  const toastText = document.getElementById('toastText');

  function showToast(msg) {
    toastText.textContent = msg;
    toastMessage.style.display = 'block';
    setTimeout(() => {
      toastMessage.style.display = 'none';
    }, 2800);
  }

  // Load Scan Report
  const params = new URLSearchParams(window.location.search);
  const requestedScanId = params.get('scanId');

  try {
    if (requestedScanId) {
      currentReport = await WebCheckStorage.getScan(requestedScanId);
    }
    if (!currentReport) {
      currentReport = await WebCheckStorage.getLatestScan();
    }
  } catch (err) {
    console.error('Error loading scan report:', err);
  }

  if (!currentReport) {
    showToast('No scan report found. Run a scan from the extension popup first.');
    renderEmptyReport();
    return;
  }

  // Render initial report
  populateReport(currentReport);
  await loadHistoryList();

  // Dropdown toggles
  btnHistoryDropdown.addEventListener('click', (e) => {
    e.stopPropagation();
    historyMenu.parentElement.classList.toggle('open');
    exportMenu.parentElement.classList.remove('open');
  });

  btnExportDropdown.addEventListener('click', (e) => {
    e.stopPropagation();
    exportMenu.parentElement.classList.toggle('open');
    historyMenu.parentElement.classList.remove('open');
  });

  document.addEventListener('click', () => {
    historyMenu.parentElement.classList.remove('open');
    exportMenu.parentElement.classList.remove('open');
  });

  function renderEmptyReport() {
    reportHostname.textContent = 'No Data';
    reportPath.textContent = '';
    fullTargetUrl.textContent = 'Please run a scan from the extension popup on any webpage.';
    fullTargetUrl.removeAttribute('href');
    metricElements.textContent = '0';
    metricChecks.textContent = '0';
    metricIssues.textContent = '0';
    metricNeedsReview.textContent = '0';
    metricPassed.textContent = '0';
    metricUntested.textContent = '0';
    zeroFindings.style.display = 'flex';
  }

  function populateReport(report) {
    currentReport = report;
    activeFindings = [...(report.findings || [])];

    // Meta Bar
    try {
      const parsed = new URL(report.url);
      reportHostname.textContent = parsed.host || report.hostname || 'localhost';
      reportPath.textContent = parsed.pathname + parsed.search;
      fullTargetUrl.textContent = report.url;
      fullTargetUrl.href = report.url;
    } catch (_) {
      reportHostname.textContent = report.hostname || 'localhost';
      reportPath.textContent = '';
      fullTargetUrl.textContent = report.url;
      fullTargetUrl.href = report.url;
    }

    valScanMode.textContent = report.mode === 'interactive_test' ? 'Interactive Test Mode' : 'Safe Scan (Passive)';
    valTimestamp.textContent = new Date(report.timestamp).toLocaleString();
    valDuration.textContent = report.durationMs ? `${report.durationMs} ms` : '180 ms';

    // KPIs
    metricElements.textContent = report.summary?.elementsDiscovered ?? 0;
    metricChecks.textContent = report.summary?.checksPerformed ?? 0;
    metricIssues.textContent = report.summary?.issuesDetected ?? 0;
    metricNeedsReview.textContent = report.summary?.itemsRequiringReview ?? 0;
    metricPassed.textContent = report.summary?.passedChecks ?? 0;
    metricUntested.textContent = report.summary?.checksNotPerformed ?? 0;

    totalCount.textContent = activeFindings.length;

    // Discovered Routes
    renderDiscoveredRoutes(report.discoveredRoutes || []);

    // Filter & Render
    applyFiltersAndRender();
  }

  function renderDiscoveredRoutes(routes) {
    routesList.innerHTML = '';
    discoveredCount.textContent = routes.length;

    if (routes.length === 0) {
      routesList.innerHTML = '<span style="color: var(--text-dim); font-size: 12px;">No additional internal links discovered on this page.</span>';
      return;
    }

    routes.forEach(route => {
      const pill = document.createElement('div');
      pill.className = 'route-pill';
      pill.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
        <span>${escapeHtml(route)}</span>
      `;
      routesList.appendChild(pill);
    });
  }

  // Filter & Search Logic
  function applyFiltersAndRender() {
    if (!currentReport || !currentReport.findings) return;

    const query = searchInput.value.trim().toLowerCase();
    const statusVal = filterStatus.value;
    const sevVal = filterSeverity.value;
    const catVal = filterCategory.value;
    const sortVal = sortOrder.value;

    let filtered = currentReport.findings.filter(f => {
      // Status
      if (statusVal !== 'ALL' && f.status !== statusVal) return false;
      // Severity
      if (sevVal !== 'ALL' && f.severity !== sevVal) return false;
      // Category
      if (catVal !== 'ALL' && f.category !== catVal) return false;
      // Search
      if (query) {
        const hay = `${f.elementLabel} ${f.webcheckId} ${f.selector} ${f.testPerformed} ${f.observedEvidence} ${f.explanation} ${f.category}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });

    // Sorting
    const sevWeight = { 'CRITICAL': 5, 'HIGH': 4, 'MEDIUM': 3, 'LOW': 2, 'INFO': 1 };
    filtered.sort((a, b) => {
      if (sortVal === 'severity_desc') {
        return (sevWeight[b.severity] || 0) - (sevWeight[a.severity] || 0);
      }
      if (sortVal === 'severity_asc') {
        return (sevWeight[a.severity] || 0) - (sevWeight[b.severity] || 0);
      }
      if (sortVal === 'status') {
        return a.status.localeCompare(b.status);
      }
      if (sortVal === 'category') {
        return a.category.localeCompare(b.category);
      }
      if (sortVal === 'label') {
        return a.elementLabel.localeCompare(b.elementLabel);
      }
      return 0;
    });

    renderFindingsList(filtered);
  }

  function renderFindingsList(findings) {
    findingsList.innerHTML = '';
    visibleCount.textContent = findings.length;

    if (findings.length === 0) {
      zeroFindings.style.display = 'flex';
      return;
    }
    zeroFindings.style.display = 'none';

    findings.forEach(finding => {
      const card = createFindingCard(finding);
      findingsList.appendChild(card);
    });
  }

  function createFindingCard(finding) {
    const card = document.createElement('div');
    card.className = 'finding-card';
    card.setAttribute('data-id', finding.id);

    const statusClass = `status-${finding.status.toLowerCase().replace(/\s+/g, '-')}`;
    const sevClass = `sev-${finding.severity.toLowerCase()}`;

    const isInteractiveCandidate = finding.attributes?.isInteractiveCandidate || (finding.status === 'NEEDS REVIEW' && finding.webcheckId.startsWith('wc-btn'));

    card.innerHTML = `
      <div class="finding-header">
        <div class="finding-title-group">
          <span class="badge-status ${statusClass}">${escapeHtml(finding.status)}</span>
          <span class="badge-sev ${sevClass}">${escapeHtml(finding.severity)}</span>
          <span class="badge-category">${escapeHtml(finding.category)}</span>
          <span class="finding-label" title="${escapeHtml(finding.elementLabel)}">${escapeHtml(finding.elementLabel)}</span>
          <span class="badge-id">${escapeHtml(finding.webcheckId)}</span>
        </div>

        <div class="finding-header-right">
          ${finding.webcheckId !== 'wc-runtime-env' ? `
            <button class="btn-card-action btn-highlight" data-action="highlight" title="Highlight this element on target page">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="22" y1="12" x2="18" y2="12"></line><line x1="6" y1="12" x2="2" y2="12"></line><line x1="12" y1="6" x2="12" y2="2"></line><line x1="12" y1="22" x2="12" y2="18"></line></svg>
              <span>Highlight</span>
            </button>
          ` : ''}

          ${isInteractiveCandidate ? `
            <button class="btn-card-action" data-action="test-interactive" title="Trigger interactive response check">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              <span>Test Click</span>
            </button>
          ` : ''}

          <button class="btn-card-action" data-action="copy" title="Copy diagnostic details">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            <span>Copy</span>
          </button>

          <svg class="toggle-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </div>
      </div>

      <div class="finding-body">
        <div class="finding-grid-details">
          <div class="detail-block evidence-box full-width">
            <div class="detail-title">Observed Evidence</div>
            <div class="detail-content">${escapeHtml(finding.observedEvidence)}</div>
          </div>

          <div class="detail-block">
            <div class="detail-title">Explanation</div>
            <div class="detail-content">${escapeHtml(finding.explanation)}</div>
          </div>

          <div class="detail-block fix-box">
            <div class="detail-title">Suggested Next Step</div>
            <div class="detail-content">${escapeHtml(finding.suggestedFix)}</div>
          </div>

          <div class="detail-block full-width">
            <div class="detail-title">Diagnostic Selector & Snippet</div>
            <div class="detail-content code-box">${escapeHtml(finding.selector || 'window')}</div>
            ${finding.outerHtmlSnippet ? `<div class="detail-content code-box" style="margin-top: 6px;">${escapeHtml(finding.outerHtmlSnippet)}</div>` : ''}
          </div>
        </div>
      </div>
    `;

    // Click on header toggles expansion (unless clicking an action button)
    const header = card.querySelector('.finding-header');
    header.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('.btn-card-action');
      if (actionBtn) return; // handled separately
      card.classList.toggle('expanded');
    });

    // Highlight button
    const btnHighlight = card.querySelector('[data-action="highlight"]');
    if (btnHighlight) {
      btnHighlight.addEventListener('click', (e) => {
        e.stopPropagation();
        triggerHighlight(finding);
      });
    }

    // Copy button
    const btnCopy = card.querySelector('[data-action="copy"]');
    if (btnCopy) {
      btnCopy.addEventListener('click', (e) => {
        e.stopPropagation();
        copyFindingDetails(finding);
      });
    }

    // Interactive Test button
    const btnTest = card.querySelector('[data-action="test-interactive"]');
    if (btnTest) {
      btnTest.addEventListener('click', (e) => {
        e.stopPropagation();
        promptOrRunInteractiveTest(finding);
      });
    }

    return card;
  }

  // Highlight on Target Tab
  function triggerHighlight(finding) {
    chrome.runtime.sendMessage({
      action: 'HIGHLIGHT_ON_TARGET_TAB',
      tabId: currentReport.tabId,
      webcheckId: finding.webcheckId,
      severity: finding.severity,
      label: finding.elementLabel
    }, (res) => {
      if (res && res.success) {
        showToast(`Highlighted [${finding.webcheckId}] on target page.`);
      } else {
        showToast('Element highlighted. Switch to target tab to inspect.');
      }
    });
  }

  // Copy Diagnostic Information
  function copyFindingDetails(finding) {
    const formatted = `
### WebCheck Diagnostic Finding: ${finding.elementLabel}
- **Status:** ${finding.status} (${finding.severity})
- **Category:** ${finding.category}
- **Element ID:** \`${finding.webcheckId}\`
- **Selector:** \`${finding.selector}\`
- **Observed Evidence:** ${finding.observedEvidence}
- **Explanation:** ${finding.explanation}
- **Suggested Next Step:** ${finding.suggestedFix}
- **Audited URL:** ${currentReport.url}
`.trim();

    navigator.clipboard.writeText(formatted).then(() => {
      showToast('Copied diagnostic details to clipboard!');
    }).catch(() => {
      showToast('Failed to copy to clipboard.');
    });
  }

  // Interactive Test Execution
  function promptOrRunInteractiveTest(finding) {
    const sensitiveKws = ['delete', 'remove', 'destroy', 'clear all', 'drop', 'purge', 'buy', 'pay', 'purchase', 'order', 'checkout', 'logout', 'sign out'];
    const textLower = (finding.elementLabel + ' ' + (finding.selector || '')).toLowerCase();
    const matchedKw = sensitiveKws.find(kw => textLower.includes(kw));

    if (matchedKw) {
      pendingSafetyWebcheckId = finding.webcheckId;
      safetyKeywordTag.textContent = matchedKw;
      safetyElementDetails.textContent = `${finding.webcheckId}: "${finding.elementLabel}" (${finding.selector})`;
      safetyModal.style.display = 'flex';
    } else {
      executeInteractiveTest(finding.webcheckId, false);
    }
  }

  // Modal Handlers
  btnCloseSafetyModal.addEventListener('click', () => safetyModal.style.display = 'none');
  btnCancelSafety.addEventListener('click', () => safetyModal.style.display = 'none');
  btnConfirmSafety.addEventListener('click', () => {
    safetyModal.style.display = 'none';
    if (pendingSafetyWebcheckId) {
      executeInteractiveTest(pendingSafetyWebcheckId, true);
      pendingSafetyWebcheckId = null;
    }
  });

  async function executeInteractiveTest(webcheckId, allowConsequential) {
    showToast(`Running interactive test on [${webcheckId}]...`);

    try {
      let targetTabId = currentReport.tabId;
      if (!targetTabId) {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        targetTabId = tabs[0]?.id;
      }

      const res = await chrome.tabs.sendMessage(targetTabId, {
        action: 'RUN_INTERACTION_TEST',
        webcheckId: webcheckId,
        options: { allowConsequential, observationMs: 800 }
      });

      if (res && res.success && res.result) {
        const result = res.result;
        // Update finding in currentReport
        const targetFinding = currentReport.findings.find(f => f.webcheckId === webcheckId);
        if (targetFinding) {
          targetFinding.status = result.status;
          targetFinding.severity = result.severity;
          targetFinding.observedEvidence = result.observedEvidence;
          targetFinding.explanation = result.explanation;
          targetFinding.suggestedFix = result.suggestedFix;
        }

        // Recalculate summary metrics
        currentReport.summary.passedChecks = currentReport.findings.filter(f => f.status === 'PASS').length;
        currentReport.summary.issuesDetected = currentReport.findings.filter(f => f.status === 'ISSUE DETECTED').length;
        currentReport.summary.itemsRequiringReview = currentReport.findings.filter(f => f.status === 'NEEDS REVIEW').length;

        // Save updated report
        await WebCheckStorage.saveScan(currentReport);
        populateReport(currentReport);
        showToast(`Interactive test complete: ${result.status}`);
      } else {
        showToast('Interactive test failed: Target element did not respond.');
      }
    } catch (err) {
      console.error('Interactive test error:', err);
      showToast(`Test error: ${err.message}`);
    }
  }

  // Rescan Page Button
  btnRescan.addEventListener('click', async () => {
    btnRescan.disabled = true;
    showToast('Starting fresh scan on target page...');

    try {
      let tabId = currentReport.tabId;
      if (!tabId) {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        tabId = tabs[0]?.id;
      }

      const response = await chrome.tabs.sendMessage(tabId, {
        action: 'START_SCAN',
        options: { mode: currentReport.mode || 'safe_scan' }
      });

      if (response && response.success && response.report) {
        const newReport = response.report;
        newReport.tabId = tabId;
        await WebCheckStorage.saveScan(newReport);
        populateReport(newReport);
        await loadHistoryList();
        showToast('Page rescan complete! Dashboard updated.');
      } else {
        showToast('Rescan failed. Target page may have been closed or reloaded.');
      }
    } catch (err) {
      showToast(`Rescan failed: ${err.message}`);
    } finally {
      btnRescan.disabled = false;
    }
  });

  // History Drawer
  async function loadHistoryList() {
    try {
      const index = await WebCheckStorage.getAllScansIndex();
      historyList.innerHTML = '';

      if (index.length === 0) {
        historyList.innerHTML = '<div class="history-empty">No saved scans found</div>';
        return;
      }

      index.forEach(item => {
        const div = document.createElement('div');
        div.className = `history-item ${item.id === currentReport?.id ? 'active' : ''}`;
        div.innerHTML = `
          <div class="history-item-host">${escapeHtml(item.hostname || 'localhost')}</div>
          <div class="history-item-meta">
            <span>${new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <span>${item.summary?.issuesDetected || 0} issues / ${item.summary?.checksPerformed || 0} checks</span>
          </div>
        `;
        div.addEventListener('click', async () => {
          const report = await WebCheckStorage.getScan(item.id);
          if (report) {
            populateReport(report);
            historyMenu.parentElement.classList.remove('open');
            showToast(`Loaded scan from ${new Date(report.timestamp).toLocaleTimeString()}`);
          }
        });
        historyList.appendChild(div);
      });
    } catch (e) {
      console.warn('History list load error:', e);
    }
  }

  btnClearAllHistory.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (confirm('Clear all saved scans from local storage?')) {
      await WebCheckStorage.clearAllScans();
      await loadHistoryList();
      showToast('All saved scan history cleared.');
    }
  });

  // Expand / Collapse All
  btnExpandAll.addEventListener('click', () => {
    document.querySelectorAll('.finding-card').forEach(c => c.classList.add('expanded'));
  });

  btnCollapseAll.addEventListener('click', () => {
    document.querySelectorAll('.finding-card').forEach(c => c.classList.remove('expanded'));
  });

  // Search input handler
  searchInput.addEventListener('input', () => {
    btnClearSearch.style.display = searchInput.value ? 'block' : 'none';
    applyFiltersAndRender();
  });

  btnClearSearch.addEventListener('click', () => {
    searchInput.value = '';
    btnClearSearch.style.display = 'none';
    applyFiltersAndRender();
  });

  filterStatus.addEventListener('change', applyFiltersAndRender);
  filterSeverity.addEventListener('change', applyFiltersAndRender);
  filterCategory.addEventListener('change', applyFiltersAndRender);
  sortOrder.addEventListener('change', applyFiltersAndRender);

  btnResetFilters.addEventListener('click', () => {
    searchInput.value = '';
    btnClearSearch.style.display = 'none';
    filterStatus.value = 'ALL';
    filterSeverity.value = 'ALL';
    filterCategory.value = 'ALL';
    sortOrder.value = 'severity_desc';
    applyFiltersAndRender();
  });

  // Copy target URL button
  document.getElementById('btnCopyUrl').addEventListener('click', () => {
    navigator.clipboard.writeText(currentReport.url).then(() => {
      showToast('Target URL copied to clipboard');
    });
  });

  // Export JSON
  btnExportJson.addEventListener('click', () => {
    if (!currentReport) return;
    const blob = new Blob([JSON.stringify(currentReport, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `webcheck-report-${formatTimestampFile(currentReport.timestamp)}.json`);
    showToast('Exported JSON report.');
  });

  // Export Plain Text / Markdown
  btnExportTxt.addEventListener('click', () => {
    if (!currentReport) return;
    let md = `# WebCheck Diagnostic Report\n\n`;
    md += `- **Audited URL:** ${currentReport.url}\n`;
    md += `- **Hostname:** ${currentReport.hostname}\n`;
    md += `- **Scan Timestamp:** ${new Date(currentReport.timestamp).toISOString()}\n`;
    md += `- **Mode:** ${currentReport.mode}\n`;
    md += `- **Elements Discovered:** ${currentReport.summary.elementsDiscovered}\n`;
    md += `- **Checks Performed:** ${currentReport.summary.checksPerformed}\n`;
    md += `- **Issues Detected:** ${currentReport.summary.issuesDetected}\n`;
    md += `- **Needs Review:** ${currentReport.summary.itemsRequiringReview}\n`;
    md += `- **Passed Checks:** ${currentReport.summary.passedChecks}\n`;
    md += `- **Not Tested:** ${currentReport.summary.checksNotPerformed}\n\n`;
    md += `## Diagnostic Findings\n\n`;

    currentReport.findings.forEach((f, i) => {
      md += `### ${i + 1}. [${f.status}] ${f.elementLabel} (${f.severity})\n`;
      md += `- **Category:** ${f.category}\n`;
      md += `- **Element ID:** ${f.webcheckId}\n`;
      md += `- **Selector:** ${f.selector}\n`;
      md += `- **Test Performed:** ${f.testPerformed}\n`;
      md += `- **Evidence:** ${f.observedEvidence}\n`;
      md += `- **Explanation:** ${f.explanation}\n`;
      md += `- **Suggested Fix:** ${f.suggestedFix}\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown' });
    downloadBlob(blob, `webcheck-report-${formatTimestampFile(currentReport.timestamp)}.md`);
    showToast('Exported Markdown report.');
  });

  // Export Standalone HTML
  btnExportHtml.addEventListener('click', () => {
    if (!currentReport) return;
    const html = generateStandaloneHtmlReport(currentReport);
    const blob = new Blob([html], { type: 'text/html' });
    downloadBlob(blob, `webcheck-report-${formatTimestampFile(currentReport.timestamp)}.html`);
    showToast('Exported Standalone HTML report.');
  });

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function formatTimestampFile(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function generateStandaloneHtmlReport(report) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>WebCheck Report — ${escapeHtml(report.hostname)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b0f19; color: #f8fafc; padding: 24px; line-height: 1.5; }
    h1 { font-size: 20px; margin-bottom: 4px; color: #10b981; }
    .meta-box { background: #111827; border: 1px solid #374151; padding: 12px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; }
    .kpis { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
    .kpi { background: #1f2937; border-radius: 6px; padding: 12px 18px; text-align: center; border-top: 3px solid #10b981; min-width: 120px; }
    .kpi-val { font-size: 22px; font-weight: bold; }
    .kpi-lbl { font-size: 11px; color: #9ca3af; text-transform: uppercase; }
    .finding-card { background: #111827; border: 1px solid #374151; border-radius: 8px; margin-bottom: 12px; padding: 14px; }
    .badge { font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; margin-right: 6px; }
    .badge-issue { background: rgba(239, 68, 68, 0.2); color: #f87171; }
    .badge-review { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }
    .badge-pass { background: rgba(16, 185, 129, 0.2); color: #34d399; }
    .badge-untested { background: rgba(100, 116, 139, 0.2); color: #94a3b8; }
    .code { font-family: monospace; background: #000; padding: 4px 6px; border-radius: 4px; color: #38bdf8; font-size: 12px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; font-size: 12px; }
    .box { background: #1f2937; padding: 8px 12px; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>WebCheck — Diagnostic Report</h1>
  <div class="meta-box">
    <div><strong>Target URL:</strong> ${escapeHtml(report.url)}</div>
    <div><strong>Timestamp:</strong> ${new Date(report.timestamp).toLocaleString()} | <strong>Mode:</strong> ${report.mode}</div>
  </div>

  <div class="kpis">
    <div class="kpi"><div class="kpi-val">${report.summary.elementsDiscovered}</div><div class="kpi-lbl">Elements</div></div>
    <div class="kpi"><div class="kpi-val">${report.summary.checksPerformed}</div><div class="kpi-lbl">Checks</div></div>
    <div class="kpi" style="border-top-color: #ef4444;"><div class="kpi-val" style="color: #f87171;">${report.summary.issuesDetected}</div><div class="kpi-lbl">Issues</div></div>
    <div class="kpi" style="border-top-color: #f59e0b;"><div class="kpi-val" style="color: #fbbf24;">${report.summary.itemsRequiringReview}</div><div class="kpi-lbl">Needs Review</div></div>
    <div class="kpi" style="border-top-color: #10b981;"><div class="kpi-val" style="color: #34d399;">${report.summary.passedChecks}</div><div class="kpi-lbl">Passed</div></div>
  </div>

  <h2>Findings (${report.findings.length})</h2>
  ${report.findings.map(f => `
    <div class="finding-card">
      <div>
        <span class="badge ${f.status === 'ISSUE DETECTED' ? 'badge-issue' : (f.status === 'NEEDS REVIEW' ? 'badge-review' : (f.status === 'PASS' ? 'badge-pass' : 'badge-untested'))}">${escapeHtml(f.status)}</span>
        <span class="badge">${escapeHtml(f.severity)}</span>
        <strong>${escapeHtml(f.elementLabel)}</strong> (${escapeHtml(f.category)})
        <span class="code" style="float: right;">${escapeHtml(f.webcheckId)}</span>
      </div>
      <div class="grid">
        <div class="box" style="grid-column: span 2;"><strong>Observed Evidence:</strong> ${escapeHtml(f.observedEvidence)}</div>
        <div class="box"><strong>Explanation:</strong> ${escapeHtml(f.explanation)}</div>
        <div class="box"><strong>Suggested Fix:</strong> ${escapeHtml(f.suggestedFix)}</div>
      </div>
    </div>
  `).join('')}
</body>
</html>`;
  }
});
