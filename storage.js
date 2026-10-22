/**
 * WebCheck — Local Storage Manager
 * Encapsulates chrome.storage.local operations with fallback support.
 * Privacy-first: All diagnostic data remains 100% on the user's device.
 */

const WebCheckStorage = {
  STORAGE_KEY_PREFIX: 'webcheck_scan_',
  INDEX_KEY: 'webcheck_scan_index',
  MAX_STORED_SCANS: 25,

  /**
   * Save a completed scan report.
   * @param {Object} scanReport 
   * @returns {Promise<string>} The unique scan ID.
   */
  async saveScan(scanReport) {
    if (!scanReport || !scanReport.id) {
      throw new Error('Invalid scan report: Missing ID.');
    }

    const scanId = scanReport.id;
    const scanKey = this.STORAGE_KEY_PREFIX + scanId;

    // Create lightweight index entry for quick listing
    const indexEntry = {
      id: scanId,
      url: scanReport.url,
      hostname: scanReport.hostname,
      timestamp: scanReport.timestamp,
      mode: scanReport.mode,
      summary: scanReport.summary
    };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      // Fetch existing index
      const data = await chrome.storage.local.get([this.INDEX_KEY]);
      let index = data[this.INDEX_KEY] || [];

      // Filter out duplicate if re-saving
      index = index.filter(item => item.id !== scanId);
      index.unshift(indexEntry);

      // Prune old scans if exceeding limit
      let keysToRemove = [];
      if (index.length > this.MAX_STORED_SCANS) {
        const removed = index.splice(this.MAX_STORED_SCANS);
        keysToRemove = removed.map(r => this.STORAGE_KEY_PREFIX + r.id);
      }

      const payload = {
        [this.INDEX_KEY]: index,
        [scanKey]: scanReport,
        webcheck_latest_scan_id: scanId
      };

      await chrome.storage.local.set(payload);

      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
      }

      return scanId;
    } else {
      // LocalStorage fallback for non-extension environments (testing/mocking)
      let index = JSON.parse(localStorage.getItem(this.INDEX_KEY) || '[]');
      index = index.filter(item => item.id !== scanId);
      index.unshift(indexEntry);
      if (index.length > this.MAX_STORED_SCANS) {
        const removed = index.splice(this.MAX_STORED_SCANS);
        removed.forEach(r => localStorage.removeItem(this.STORAGE_KEY_PREFIX + r.id));
      }
      localStorage.setItem(this.INDEX_KEY, JSON.stringify(index));
      localStorage.setItem(scanKey, JSON.stringify(scanReport));
      localStorage.setItem('webcheck_latest_scan_id', scanId);
      return scanId;
    }
  },

  /**
   * Retrieve a specific scan by ID.
   * @param {string} scanId 
   * @returns {Promise<Object|null>}
   */
  async getScan(scanId) {
    if (!scanId) return null;
    const scanKey = this.STORAGE_KEY_PREFIX + scanId;

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const data = await chrome.storage.local.get([scanKey]);
      return data[scanKey] || null;
    } else {
      const item = localStorage.getItem(scanKey);
      return item ? JSON.parse(item) : null;
    }
  },

  /**
   * Get the most recently completed scan.
   * @returns {Promise<Object|null>}
   */
  async getLatestScan() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const data = await chrome.storage.local.get(['webcheck_latest_scan_id']);
      const latestId = data.webcheck_latest_scan_id;
      if (!latestId) return null;
      return await this.getScan(latestId);
    } else {
      const latestId = localStorage.getItem('webcheck_latest_scan_id');
      if (!latestId) return null;
      return await this.getScan(latestId);
    }
  },

  /**
   * Get index list of all saved scans (without heavy findings payloads).
   * @returns {Promise<Array>}
   */
  async getAllScansIndex() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const data = await chrome.storage.local.get([this.INDEX_KEY]);
      return data[this.INDEX_KEY] || [];
    } else {
      return JSON.parse(localStorage.getItem(this.INDEX_KEY) || '[]');
    }
  },

  /**
   * Delete a scan by ID.
   * @param {string} scanId 
   */
  async deleteScan(scanId) {
    if (!scanId) return;
    const scanKey = this.STORAGE_KEY_PREFIX + scanId;

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const data = await chrome.storage.local.get([this.INDEX_KEY, 'webcheck_latest_scan_id']);
      let index = data[this.INDEX_KEY] || [];
      index = index.filter(item => item.id !== scanId);
      let updates = { [this.INDEX_KEY]: index };
      if (data.webcheck_latest_scan_id === scanId) {
        updates.webcheck_latest_scan_id = index.length > 0 ? index[0].id : null;
      }
      await chrome.storage.local.set(updates);
      await chrome.storage.local.remove([scanKey]);
    } else {
      let index = JSON.parse(localStorage.getItem(this.INDEX_KEY) || '[]');
      index = index.filter(item => item.id !== scanId);
      localStorage.setItem(this.INDEX_KEY, JSON.stringify(index));
      if (localStorage.getItem('webcheck_latest_scan_id') === scanId) {
        localStorage.setItem('webcheck_latest_scan_id', index.length > 0 ? index[0].id : '');
      }
      localStorage.removeItem(scanKey);
    }
  },

  /**
   * Clear all saved scans.
   */
  async clearAllScans() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const data = await chrome.storage.local.get([this.INDEX_KEY]);
      const index = data[this.INDEX_KEY] || [];
      const keys = index.map(i => this.STORAGE_KEY_PREFIX + i.id);
      keys.push(this.INDEX_KEY);
      keys.push('webcheck_latest_scan_id');
      await chrome.storage.local.remove(keys);
    } else {
      const index = JSON.parse(localStorage.getItem(this.INDEX_KEY) || '[]');
      index.forEach(i => localStorage.removeItem(this.STORAGE_KEY_PREFIX + i.id));
      localStorage.removeItem(this.INDEX_KEY);
      localStorage.removeItem('webcheck_latest_scan_id');
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = WebCheckStorage;
}
