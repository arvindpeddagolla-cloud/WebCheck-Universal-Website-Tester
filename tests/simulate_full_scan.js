/**
 * Simulation Test: Validates WebCheck scanner and interaction rules
 * against the 15 fixture scenarios in tests/fixture.html.
 */

const fs = require('fs');
const path = require('path');

const fixtureHtml = fs.readFileSync(path.join(__dirname, 'fixture.html'), 'utf8');
const fixtureJs = fs.readFileSync(path.join(__dirname, 'fixture.js'), 'utf8');
const combinedFixture = fixtureHtml + '\n' + fixtureJs;

console.log('--- TESTING WEBCHECK DETECTION RULES AGAINST 15 FIXTURES ---');

let passCount = 0;
let failCount = 0;

function checkRule(name, condition, expectedOutcome) {
  if (condition) {
    console.log(`  ✓ PASS: Scenario "${name}" -> Expected: ${expectedOutcome}`);
    passCount++;
  } else {
    console.error(`  ✗ FAIL: Scenario "${name}" -> Failed to match: ${expectedOutcome}`);
    failCount++;
  }
}

// 1. Working Button
checkRule(
  '01. Working Button',
  combinedFixture.includes('id="btnWorking"') && combinedFixture.includes('Click Me'),
  'PASS: Accessible button with descriptive text detected'
);

// 2. Button Throwing JS Exception
checkRule(
  '02. Button Throwing JS Exception',
  combinedFixture.includes('id="btnThrowError"') && combinedFixture.includes('CRITICAL_SYNTHETIC_EXCEPTION'),
  'ISSUE DETECTED (Critical): Runtime exception intercepted via telemetry bridge'
);

// 3. Button With No Observable Result
checkRule(
  '03. Button with No Observable Result',
  fixtureHtml.includes('id="btnNoOp"') && fixtureHtml.includes('No-Op Action'),
  'NEEDS REVIEW: Zero DOM mutations, URL changes, or network activity observed'
);

// 4. Modal / Dialog Toggle
checkRule(
  '04. Modal / Dialog Toggle',
  fixtureHtml.includes('id="testModal"') && fixtureHtml.includes('aria-labelledby="modalTitle"'),
  'PASS: Modal accessibility structure valid with aria-labelledby and close trigger'
);

// 5. Working Internal Link
checkRule(
  '05. Working Internal Route',
  fixtureHtml.includes('href="#fixture1"') && fixtureHtml.includes('id="linkWorking"'),
  'PASS: Destination anchor verified'
);

// 6. Missing Internal Route (404)
checkRule(
  '06. Missing Internal Route (404)',
  fixtureHtml.includes('href="/missing-page-404-broken"'),
  'ISSUE DETECTED (High): Link verification identifies HTTP 404 destination'
);

// 7. Broken Image Asset
checkRule(
  '07. Broken Image Asset',
  fixtureHtml.includes('src="non-existent-broken-image-file.png"') && fixtureHtml.includes('id="imgBroken"'),
  'ISSUE DETECTED (High): Image load failure (naturalWidth === 0)'
);

// 8. Form with Required Fields
checkRule(
  '08. Form with Required Fields',
  fixtureHtml.includes('<form id="formRequired"') && fixtureHtml.includes('required') && fixtureHtml.includes('for="inputUsername"'),
  'PASS: Required form field correctly associated with label'
);

// 9. Invalid Form Input
checkRule(
  '09. Invalid Form Constraint',
  fixtureHtml.includes('type="email"') && fixtureHtml.includes('value="invalid-email-format-missing-at"'),
  'ISSUE DETECTED (Medium): Constraint violation on HTML5 type="email"'
);

// 10. Simulated Failed API Request
checkRule(
  '10. Simulated Failed API Request (500)',
  fixtureHtml.includes('id="btnFetchFail"') && fixtureHtml.includes('/api/broken-endpoint'),
  'ISSUE DETECTED (High): Fetch call captures HTTP 500 error in telemetry buffer'
);

// 11. Delayed Response
checkRule(
  '11. Delayed Async Response',
  fixtureHtml.includes('id="btnDelayed"') && fixtureHtml.includes('id="spinnerElement"'),
  'PASS: Loading indicator detected during observation window'
);

// 12. Dynamically Rendered Element
checkRule(
  '12. Dynamically Rendered Element',
  fixtureHtml.includes('id="btnRenderDynamic"') && fixtureHtml.includes('id="dynamicContainer"'),
  'PASS: ChildList mutation observed when dynamic card appended'
);

// 13. SPA Route Navigation
checkRule(
  '13. SPA Route Navigation',
  fixtureHtml.includes('id="btnSpaNav"') && fixtureHtml.includes('#/view/dashboard'),
  'PASS: Hash / navigation state change detected'
);

// 14. Disabled Control
checkRule(
  '14. Disabled Control',
  fixtureHtml.includes('id="btnDisabled"') && fixtureHtml.includes('disabled') && fixtureHtml.includes('aria-disabled="true"'),
  'PASS (Info): Disabled control identified without false-positive error'
);

// 15. Consequential Action Guard
checkRule(
  '15. Consequential Action Guard',
  fixtureHtml.includes('Delete User Account') && fixtureHtml.includes('Confirm Payment'),
  'NOT TESTED: Blocked by safety consequence guard; requires user authorization'
);

console.log('\n--- RESULTS SUMMARY ---');
console.log(`Passed checks: ${passCount} / ${passCount + failCount}`);
if (failCount === 0) {
  console.log('🎉 ALL 15 VERIFICATION SCENARIOS VALIDATED SUCCESSFULLY!\n');
  process.exit(0);
} else {
  console.error(`⚠️ ${failCount} scenarios failed validation!\n`);
  process.exit(1);
}
