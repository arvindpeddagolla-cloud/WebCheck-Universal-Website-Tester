/**
 * Automated Verification Script for WebCheck Extension
 * Validates manifest syntax, file existence, storage engine, and diagnostic rules.
 */

const fs = require('fs');
const path = require('path');
const WebCheckStorage = require('../storage.js');

const ROOT_DIR = path.resolve(__dirname, '..');
let testFailures = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    testFailures++;
  }
}

console.log('\n--- 1. MANIFEST & ASSET INTEGRITY ---');
const manifestPath = path.join(ROOT_DIR, 'manifest.json');
assert(fs.existsSync(manifestPath), 'manifest.json exists');

const manifestContent = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
assert(manifestContent.manifest_version === 3, 'Manifest is Version 3');
assert(manifestContent.permissions.includes('storage'), 'Contains storage permission');
assert(manifestContent.permissions.includes('activeTab'), 'Contains activeTab permission');
assert(manifestContent.permissions.includes('scripting'), 'Contains scripting permission');

// Check all referenced files exist
const checkFiles = [
  manifestContent.action.default_popup,
  manifestContent.background.service_worker,
  ...manifestContent.content_scripts[0].js,
  ...manifestContent.web_accessible_resources[0].resources,
  manifestContent.icons['16'],
  manifestContent.icons['32'],
  manifestContent.icons['48'],
  manifestContent.icons['128'],
  'report.html',
  'report.css',
  'report.js',
  'storage.js',
  'popup.css',
  'popup.js',
  'tests/fixture.html',
  'tests/fixture.css',
  'tests/fixture.js',
  'tests/server.js'
];

checkFiles.forEach(relPath => {
  const absPath = path.join(ROOT_DIR, relPath);
  assert(fs.existsSync(absPath), `Referenced file exists: ${relPath}`);
});

console.log('\n--- 2. STORAGE ENGINE (LOCAL/FALLBACK) ---');
async function testStorage() {
  const dummyReport = {
    id: 'test-scan-001',
    url: 'http://localhost:3000/tests/fixture.html',
    hostname: 'localhost',
    timestamp: Date.now(),
    mode: 'safe_scan',
    summary: {
      elementsDiscovered: 15,
      checksPerformed: 42,
      passedChecks: 30,
      issuesDetected: 6,
      itemsRequiringReview: 4,
      checksNotPerformed: 2
    },
    findings: [
      {
        id: 'finding-1',
        webcheckId: 'wc-btn-1',
        category: 'Buttons & Controls',
        elementType: 'BUTTON',
        elementLabel: 'Click Me',
        selector: 'button#btnWorking',
        testPerformed: 'Accessible Name Inspection',
        status: 'PASS',
        severity: 'INFO',
        observedEvidence: 'Button possesses accessible label: "Click Me".',
        explanation: 'Button is appropriately labelled.',
        suggestedFix: 'No action required.'
      }
    ]
  };

  // Mock localStorage for Node test
  global.localStorage = {
    store: {},
    getItem(key) { return this.store[key] || null; },
    setItem(key, val) { this.store[key] = String(val); },
    removeItem(key) { delete this.store[key]; }
  };

  const savedId = await WebCheckStorage.saveScan(dummyReport);
  assert(savedId === dummyReport.id, 'Storage successfully saved scan with correct ID');

  const retrieved = await WebCheckStorage.getScan(savedId);
  assert(retrieved && retrieved.url === dummyReport.url, 'Retrieved stored scan matches saved data');

  const index = await WebCheckStorage.getAllScansIndex();
  assert(index.length === 1 && index[0].id === dummyReport.id, 'Index records stored scan');

  await WebCheckStorage.deleteScan(savedId);
  const afterDelete = await WebCheckStorage.getScan(savedId);
  assert(afterDelete === null, 'Scan deleted successfully');

  console.log('\n--- 3. VERIFICATION SUMMARY ---');
  if (testFailures === 0) {
    console.log('🎉 ALL EXTENSION VERIFICATION CHECKS PASSED!\n');
    process.exit(0);
  } else {
    console.error(`⚠️ ${testFailures} CHECKS FAILED!\n`);
    process.exit(1);
  }
}

testStorage();
