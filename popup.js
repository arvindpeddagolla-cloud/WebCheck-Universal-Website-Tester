/**
 * WebCheck — Extension Popup Controller
 * Connects UI controls to the active tab, initiates scans,
 * tracks progress, and saves diagnostic reports.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const targetHost = document.getElementById('targetHost');
  const targetUrl = document.getElementById('targetUrl');
  const targetStatusDot = document.getElementById('targetStatusDot');
  const restrictedNotice = document.getElementById('restrictedNotice');
  const restrictedMessage = document.getElementById('restrictedMessage');

  const modeCardSafe = document.getElementById('modeCardSafe');
  const modeCardInteractive = document.getElementById('modeCardInteractive');
  const radioSafe = modeCardSafe.querySelector('input');
  const radioInteractive = modeCardInteractive.querySelector('input');

  const btnScanWebsite = document.getElementById('btnScanWebsite');
  const scanBtnText = document.getElementById('scanBtnText');
  const scanBtnIcon = document.getElementById('scanBtnIcon');

  const progressContainer = document.getElementById('progressContainer');
  const progressBarFill = document.getElementById('progressBarFill');
  const progressStatusText = document.getElementById('progressStatusText');

  const resultsPreview = document.getElementById('resultsPreview');
  const emptyState = document.getElementById('emptyState');
  const scanTimestamp = document.getElementById('scanTimestamp');
  const countIssues = document.getElementById('countIssues');
  const countNeedsReview = document.getElementById('countNeedsReview');
  const countPassed = document.getElementById('countPassed');
  const countDiscovered = document.getElementById('countDiscovered');
  const countChecks = document.getElementById('countChecks');

  const btnViewFullReport = document.getElementById('btnViewFullReport');
  const btnOpenDashboard = document.getElementById('btnOpenDashboard');
  const linkClearData = document.getElementById('linkClearData');

  let activeTab = null;
  let currentScanId = null;
  let isScanning = false;

  // Mode Selection Handlers
  function updateModeSelection() {
    if (radioSafe.checked) {
      modeCardSafe.classList.add('active');
      modeCardInteractive.classList.remove('active');
    } else {
      modeCardSafe.classList.remove('active');
      modeCardInteractive.classList.add('active');
    }
  }

  modeCardSafe.addEventListener('click', () => {
    radioSafe.checked = true;
    updateModeSelection();
  });

  modeCardInteractive.addEventListener('click', () => {
    radioInteractive.checked = true;
    updateModeSelection();
  });

  // Query Current Active Tab
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTab = tabs[0];
  } catch (err) {
    console.warn('Failed to get active tab:', err);
  }

  if (!activeTab || !activeTab.url) {
    setRestrictedState('Unable to read active tab. Switch to an open website and try again.');
    return;
  }

  const urlStr = activeTab.url;
  let isRestricted = false;

  const restrictedPrefixes = [
    'chrome://',
    'chrome-extension://',
    'chrome-search://',
    'edge://',
    'about:',
    'devtools://',
    'brave://',
    'opera://',
    'vivaldi://',
    'view-source:',
    'data:',
    'blob:',
    'javascript:'
  ];

  if (restrictedPrefixes.some(prefix => urlStr.startsWith(prefix))) {
    setRestrictedState('WebCheck cannot run on browser internal or extension pages. Navigate to a website or local development server (e.g. localhost or https://).');
  } else if (urlStr.includes('chromewebstore.google.com') || urlStr.includes('chrome.google.com/webstore')) {
    setRestrictedState('Chrome security policies prevent extensions from inspecting the Chrome Web Store.');
  } else if (urlStr.startsWith('file://')) {
    // Check if user has toggled "Allow access to file URLs"
    if (chrome.extension && typeof chrome.extension.isAllowedFileSchemeAccess === 'function') {
      const allowed = await new Promise(res => chrome.extension.isAllowedFileSchemeAccess(res));
      if (!allowed) {
        setRestrictedState('Local file detected (file://). To allow scanning local files, open chrome://extensions, click "Details" on WebCheck, and turn ON "Allow access to file URLs".');
      }
    }
  } else if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
    setRestrictedState('WebCheck supports standard HTTP, HTTPS, and local file:// websites.');
  }

  if (!isRestricted) {
    btnScanWebsite.disabled = false;
    btnScanWebsite.style.opacity = '1';
    restrictedNotice.style.display = 'none';

    try {
      const parsed = new URL(urlStr);
      targetHost.textContent = parsed.host || parsed.hostname || 'localhost';
      targetUrl.textContent = urlStr;
      targetUrl.title = urlStr;
      targetStatusDot.className = 'status-indicator live';
    } catch (_) {
      targetHost.textContent = 'Active Page';
      targetUrl.textContent = urlStr;
    }

    // Check if there is an existing scan for this URL or latest scan
    await loadExistingScan(urlStr);
  }

  function setRestrictedState(msg) {
    isRestricted = true;
    restrictedNotice.style.display = 'flex';
    restrictedMessage.textContent = msg;
    targetStatusDot.className = 'status-indicator offline';
    targetHost.textContent = 'Restricted Page';
    targetUrl.textContent = activeTab?.url || 'Inaccessible';
    btnScanWebsite.disabled = true;
    btnScanWebsite.style.opacity = '0.5';
  }

  async function loadExistingScan(url) {
    try {
      const latest = await WebCheckStorage.getLatestScan();
      if (latest) {
        currentScanId = latest.id;
        displayScanSummary(latest);
      }
    } catch (e) {
      console.warn('Could not load stored scan:', e);
    }
  }

  function displayScanSummary(report) {
    if (!report || !report.summary) return;
    emptyState.style.display = 'none';
    resultsPreview.style.display = 'flex';

    countIssues.textContent = report.summary.issuesDetected || 0;
    countNeedsReview.textContent = report.summary.itemsRequiringReview || 0;
    countPassed.textContent = report.summary.passedChecks || 0;
    countDiscovered.textContent = report.summary.elementsDiscovered || 0;
    countChecks.textContent = report.summary.checksPerformed || 0;

    const timeDiff = Date.now() - (report.timestamp || Date.now());
    if (timeDiff < 60000) {
      scanTimestamp.textContent = 'Just now';
    } else {
      const mins = Math.floor(timeDiff / 60000);
      scanTimestamp.textContent = `${mins}m ago`;
    }
  }

  // Scan Execution
  btnScanWebsite.addEventListener('click', async () => {
    if (isScanning || isRestricted || !activeTab?.id) return;
    isScanning = true;

    btnScanWebsite.disabled = true;
    scanBtnText.textContent = 'Scanning...';
    progressContainer.style.display = 'flex';
    progressBarFill.style.width = '15%';
    progressStatusText.textContent = 'Discovering interactive elements...';

    const mode = radioInteractive.checked ? 'interactive_test' : 'safe_scan';

    try {
      // Step 1: Ensure content script is ready
      progressBarFill.style.width = '35%';
      progressStatusText.textContent = 'Injecting diagnostics probe...';

      let response = null;
      try {
        response = await chrome.tabs.sendMessage(activeTab.id, {
          action: 'START_SCAN',
          options: { mode }
        });
      } catch (sendErr) {
        // If content script was not already loaded on this page, inject on demand
        try {
          await chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            files: ['error-monitor.js', 'scanner.js', 'interaction-tester.js', 'content.js']
          });
          // Small pause for DOM hookup
          await new Promise(r => setTimeout(r, 250));

          response = await chrome.tabs.sendMessage(activeTab.id, {
            action: 'START_SCAN',
            options: { mode }
          });
        } catch (injectErr) {
          const errMsg = (injectErr?.message || sendErr?.message || '');
          if (errMsg.includes('Cannot access contents') || errMsg.includes('permission') || errMsg.includes('host')) {
            if (urlStr.startsWith('file://')) {
              throw new Error('Local file access disabled. Go to chrome://extensions -> WebCheck Details -> enable "Allow access to file URLs", then refresh this tab.');
            } else {
              throw new Error('This page cannot be inspected due to browser security restrictions. Please navigate to a standard website (http/https).');
            }
          }
          throw injectErr;
        }
      }

      progressBarFill.style.width = '75%';
      progressStatusText.textContent = 'Evaluating checks & HTTP routes...';

      if (!response || !response.success || !response.report) {
        throw new Error(response?.error || 'Content scanner failed to return report.');
      }

      progressBarFill.style.width = '95%';
      progressStatusText.textContent = 'Saving diagnostic findings...';

      const scanReport = response.report;
      // Tag tab ID so highlight works smoothly
      scanReport.tabId = activeTab.id;

      currentScanId = await WebCheckStorage.saveScan(scanReport);

      progressBarFill.style.width = '100%';
      progressStatusText.textContent = 'Scan complete!';

      await new Promise(r => setTimeout(r, 350));
      progressContainer.style.display = 'none';

      displayScanSummary(scanReport);
    } catch (err) {
      console.warn('Scan notice:', err);
      progressStatusText.textContent = err.message || 'Scan could not be completed.';
      progressBarFill.style.background = '#ef4444';
      setTimeout(() => {
        progressContainer.style.display = 'none';
      }, 5000);
    } finally {
      isScanning = false;
      if (!isRestricted) {
        btnScanWebsite.disabled = false;
        btnScanWebsite.style.opacity = '1';
      }
      scanBtnText.textContent = 'Scan Website';
    }
  });

  // Open Full Report Page
  function openFullReport() {
    chrome.runtime.sendMessage({
      action: 'OPEN_REPORT_TAB',
      scanId: currentScanId || ''
    });
  }

  btnViewFullReport.addEventListener('click', openFullReport);
  btnOpenDashboard.addEventListener('click', openFullReport);

  // Clear Cache
  linkClearData.addEventListener('click', async (e) => {
    e.preventDefault();
    if (confirm('Clear all saved WebCheck scan reports from local storage?')) {
      await WebCheckStorage.clearAllScans();
      resultsPreview.style.display = 'none';
      emptyState.style.display = 'flex';
      currentScanId = null;
    }
  });
});
