/**
 * WebCheck — Service Worker Background Script (MV3)
 * Handles tab orchestration, navigation, and opening the comprehensive report.
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log('[WebCheck] Universal Website Tester extension installed successfully.');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'OPEN_REPORT_TAB') {
    const scanId = message.scanId || '';
    const reportUrl = chrome.runtime.getURL(`report.html${scanId ? `?scanId=${encodeURIComponent(scanId)}` : ''}`);

    chrome.tabs.create({ url: reportUrl }, (tab) => {
      sendResponse({ success: true, tabId: tab.id });
    });
    return true;
  }

  if (message.action === 'HIGHLIGHT_ON_TARGET_TAB') {
    const { tabId, webcheckId, severity, label } = message;
    if (tabId) {
      // First activate the tab so user can see the highlight
      chrome.tabs.update(tabId, { active: true }, () => {
        chrome.tabs.sendMessage(tabId, {
          action: 'HIGHLIGHT_ELEMENT',
          webcheckId,
          severity,
          label
        }, (res) => {
          sendResponse({ success: res?.success || false });
        });
      });
      return true;
    } else {
      // Broadcast to active tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'HIGHLIGHT_ELEMENT',
            webcheckId,
            severity,
            label
          }, (res) => {
            sendResponse({ success: res?.success || false });
          });
        } else {
          sendResponse({ success: false, error: 'No active tab found.' });
        }
      });
      return true;
    }
  }
});
