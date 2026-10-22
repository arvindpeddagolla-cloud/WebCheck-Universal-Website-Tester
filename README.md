# WebCheck — Universal Website Tester

[![Manifest V3](https://img.shields.io/badge/Chrome_Extension-Manifest_V3-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Tests Passing](https://img.shields.io/badge/Tests-15%2F15_Passing-success?style=for-the-badge&logo=checkmarx&logoColor=white)](tests/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)
[![Zero Telemetry](https://img.shields.io/badge/Privacy-100%25_Local_%26_Offline-green?style=for-the-badge)](README.md#7-privacy--security-statement)

> **Production-grade Chrome Extension (Manifest V3) for automated DOM inspection, accessibility auditing, link health verification, form validation, image integrity, and runtime error diagnosis.**

---

## 1. Product Overview

**WebCheck** is a developer-centric Chrome extension that inspects websites of any type—plain HTML/JS, React, Vue, Next.js, Angular, Svelte, or multi-page apps—running locally (e.g. `localhost:3000`, `localhost:5173`, `127.0.0.1:8080`) or deployed on public web servers.

When a developer clicks **Scan Website**, WebCheck dynamically discovers interactive elements, evaluates deterministic functionality rules, captures runtime JavaScript exceptions, verifies same-origin HTTP routes, and produces an actionable diagnostic report.

### Strict Technology Compliance
- **100% Local & Privacy-Conscious:** Zero external AI/LLM models, zero external API services, zero backend servers, zero database servers, and zero telemetry/analytics trackers.
- **Offline Capable:** Runs entirely within Chrome without an active internet connection.
- **Manifest V3:** Built strictly to modern Chrome Extension standards using ES6+ Vanilla JavaScript, semantic HTML5, and CSS3.

---

## 2. Architecture & File Structure

```
├── manifest.json                  # Manifest V3 specification & permissions
├── popup.html                     # Extension popup interface
├── popup.css                      # Popup dark theme styling
├── popup.js                       # Popup controller & scan coordinator
├── content.js                     # Content script coordinator & element highlighter
├── scanner.js                     # Dynamic DOM inspection & rule engine
├── interaction-tester.js          # Safe interaction tester with consequence guards
├── error-monitor.js               # Content script telemetry receiver & event listener
├── page-bridge.js                 # MAIN world script capturing uncaught page errors & fetch failures
├── report.html                    # Full dashboard & diagnostic report tab
├── report.css                     # Developer dashboard dark theme CSS
├── report.js                      # Report controller: search, filters, highlight, export
├── storage.js                     # chrome.storage.local wrapper with fallback
├── icons/                         # Extension icons (16px, 32px, 48px, 128px)
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── tests/                         # Local verification suite & fixtures
│   ├── fixture.html               # 15 verification scenarios interactive page
│   ├── fixture.css                # Fixture page layout
│   ├── fixture.js                 # Fixture interactive handlers (errors, counters, modals)
│   ├── server.js                  # Local Node.js HTTP server (handles mock 500 & 404 endpoints)
│   ├── verify_manifest_and_engine.js # Automated manifest & storage verification test
│   └── simulate_full_scan.js      # Automated rule engine verification test
├── create_icons.py                # Pure Python script used to render PNG icons
└── webcheck-extension-v1.0.0.zip  # Ready-to-submit Chrome Web Store package
```

---

## 3. Core Features & Capabilities

### 🔍 Dynamic DOM Inspection Engine (`scanner.js`)
- Dynamically assigns temporary diagnostic identifiers (`data-webcheck-id="wc-..."`) to elements without modifying host application state or styling.
- Inspects:
  - **Buttons & Controls:** Native `<button>`, `<input type="button|submit|reset">`, `[role="button"]`, and custom clickable elements (`cursor: pointer`).
  - **Links & Navigation:** Identifies empty `href=""`, placeholder `href="#"`, `javascript:void(0)`, missing `href`, external links missing `rel="noopener"`, and performs safe non-destructive `HEAD`/`GET` verification on same-origin routes to flag HTTP 404/500 broken links.
  - **Forms & Inputs:** Validates associated `<label>` or ARIA labeling, required field indicators, HTML5 validation constraint mismatches, and submit button availability.
  - **Images & Media:** Identifies broken images (`naturalWidth === 0`), missing `alt` attributes, and empty or invalid `src` paths.
  - **Dialogs, Modals & Tabs:** Checks `role="dialog"` accessible names (`aria-labelledby`), visible modal accessibility, and `[role="tab"]` state attributes (`aria-selected`).

### ⚡ Runtime Error & Network Telemetry Bridge (`page-bridge.js` & `error-monitor.js`)
- Injects a lightweight bridge into the page's `MAIN` execution world.
- Intercepts:
  - Uncaught script exceptions (`window.onerror`).
  - Unhandled promise rejections (`unhandledrejection`).
  - Failed network requests (`fetch` and `XMLHttpRequest` returning HTTP >= 400 or network dropouts) without accessing sensitive headers, cookies, or body data.
  - Static resource load failures (broken script, style, or image tags).

### 🛡️ Dual Testing Modes & Consequence Guards (`interaction-tester.js`)
- **Mode A (Safe Scan):** Passive, read-only inspection. Examines DOM structures, accessibility attributes, broken routes, and observed errors without clicking or mutating application state.
- **Mode B (Interactive Test):** Actively tests controls with a `MutationObserver` and event monitor to measure observable response (DOM additions, route/hash changes, loading indicators).
- **Consequence Guards:** Elements with sensitive keywords (e.g. `delete`, `remove`, `destroy`, `purge`, `buy`, `pay`, `purchase`, `order`, `checkout`, `logout`) are marked as `NOT TESTED` during automated passes. Triggering an interactive test on a sensitive element requires explicit user confirmation in a safety authorization modal.

### 🎯 Live Element Highlighting (`content.js`)
- Clicking **Highlight** on any finding in the dashboard automatically scrolls the target element into view (`scrollIntoView({ behavior: 'smooth', block: 'center' })`).
- Displays an animated, pulsing glowing ring color-coded by issue severity, plus a floating viewport badge showing the diagnostic ID and element label.

### 📊 Full Developer Dashboard (`report.html`)
- Opens in its own browser tab for maximum readability.
- **KPI Summary Grid:** Elements Discovered, Checks Performed, Passed Checks, Issues Detected, Needs Review, Checks Not Performed.
- **Search & Multi-Axis Filters:** Real-time text search, filter by Status (`ISSUE DETECTED`, `NEEDS REVIEW`, `PASS`, `NOT TESTED`), filter by Severity (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `INFO`), filter by Category, and sort.
- **Export Formats:**
  - **JSON:** Complete raw diagnostic tree for automated pipelines.
  - **Standalone HTML:** Self-contained offline HTML report with embedded styles and metrics.
  - **Plain Text / Markdown:** Formatted markdown summary for GitHub issues or bug tickets.
- **Persistent Scan History:** Saves up to 25 reports locally via `chrome.storage.local`.

---

## 4. Installation Instructions

To install and run WebCheck in Google Chrome:

1. Open Google Chrome.
2. Navigate to: `chrome://extensions/`
3. In the top-right corner, toggle **Developer mode** to **ON**.
4. In the top-left corner, click **Load unpacked**.
5. Select the extension directory:
   ```
   c:\Users\Shoba\Downloads\etxension
   ```
6. The **WebCheck — Universal Website Tester** card will appear with its shield icon and version `1.0.0`.
7. Click the extension puzzle icon in the Chrome toolbar and pin **WebCheck** for easy access.

---

## 5. Verification Against Local Test Fixtures

The workspace includes a complete 15-scenario verification fixture page at `tests/fixture.html` and a standalone test server at `tests/server.js`.

### Step 1: Start the Local Test Server
Open a terminal in the extension directory and run:
```bash
node tests/server.js 3000
```
The server will start listening at `http://localhost:3000/tests/fixture.html`.

### Step 2: Open the Fixture in Chrome
Navigate to `http://localhost:3000/tests/fixture.html`.

### Step 3: Run WebCheck
1. Click the **WebCheck** extension icon in your toolbar.
2. Select **Safe Scan** (or **Interactive Test**).
3. Click **Scan Website**.
4. View the instant summary cards in the popup.
5. Click **View Full Detailed Report** to open the comprehensive dashboard.

### Verification of the 15 Scenarios:
| # | Scenario | Element in Fixture | Expected Diagnostic Finding | Status |
|---|---|---|---|---|
| **01** | Working button | `#btnWorking` | Accessible name valid; increments counter upon test | `PASS` |
| **02** | Throws JS exception | `#btnThrowError` | `CRITICAL_SYNTHETIC_EXCEPTION` caught by telemetry bridge | `ISSUE DETECTED` (Critical) |
| **03** | No observable result | `#btnNoOp` | No DOM/URL/network change observed during test | `NEEDS REVIEW` |
| **04** | Modal toggle | `#btnOpenModal` | Accessible modal opens with valid title & close button | `PASS` |
| **05** | Working internal link | `#linkWorking` | Internal anchor `#fixture1` valid and reachable | `PASS` |
| **06** | Missing internal route | `#linkMissing` | Route `/missing-page-404-broken` returns HTTP 404 | `ISSUE DETECTED` (High) |
| **07** | Broken image asset | `#imgBroken` | Source missing (`naturalWidth === 0`) | `ISSUE DETECTED` (High) |
| **08** | Form with required field | `#formRequired` | Required field properly associated with `<label>` | `PASS` |
| **09** | Invalid form constraint | `#inputEmailInvalid` | Pre-filled value violates HTML5 `type="email"` | `ISSUE DETECTED` (Medium) |
| **10** | Simulated failed API (500) | `#btnFetchFail` | Intercepted HTTP 500 error from `/api/broken-endpoint` | `ISSUE DETECTED` (High) |
| **11** | Delayed response | `#btnDelayed` | Loading spinner detected during observation window | `PASS` |
| **12** | Dynamically rendered node | `#btnRenderDynamic` | ChildList mutation detected when dynamic card is inserted | `PASS` |
| **13** | SPA route change | `#btnSpaNav` | Window hash updated to `#/view/dashboard` | `PASS` |
| **14** | Disabled control | `#btnDisabled` | Control has `disabled` attribute; interaction prevented | `PASS` (Info) |
| **15** | Consequential action guard | `#btnDeleteAccount` | Destructive action blocked; requires explicit safety approval | `NOT TESTED` |

### Step 4: Run Automated Verification Tests
You can verify the entire extension without opening a browser:
```bash
# 1. Verify manifest, permissions, and storage engine:
node tests/verify_manifest_and_engine.js

# 2. Verify detection rules against all 15 scenarios:
node tests/simulate_full_scan.js
```
Both tests will execute and confirm that all rules and integrity checks pass.

---

## 6. Chrome Web Store Packaging & Submission

A production package `webcheck-extension-v1.0.0.zip` has already been built.

### Re-generating the Package
To re-build the distribution ZIP at any time:
```powershell
Compress-Archive -Path manifest.json, popup.html, popup.css, popup.js, content.js, scanner.js, interaction-tester.js, error-monitor.js, background.js, page-bridge.js, report.html, report.css, report.js, storage.js, icons -DestinationPath webcheck-extension-v1.0.0.zip -Force
```

### Chrome Web Store Submission Checklist:
1. **Developer Account:** Log into the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. **Upload Package:** Click **Add new item** and upload `webcheck-extension-v1.0.0.zip`.
3. **Permissions Justification:**
   - `activeTab`: Required to inspect the DOM of the active tab when the developer initiates a scan.
   - `storage`: Required to store diagnostic reports locally on the user's computer.
   - `scripting`: Required to inject the diagnostic engine and highlight active elements on demand.
   - `<all_urls>` (Host Permissions): Required to allow developers to inspect websites running on arbitrary local ports (`localhost:3000`, `127.0.0.1:8080`, etc.) and public testing environments.
4. **Privacy Policy:** Declare that WebCheck does not collect, process, or transmit any user data, passwords, cookies, or personal information. All diagnostic data remains 100% on the device.

---

## 7. Privacy & Security Statement

- **No Remote Code:** WebCheck contains zero `eval()` calls and loads no remote scripts or third-party CDNs.
- **No Telemetry / No Tracking:** WebCheck does not send analytics, telemetry, or diagnostic reports to any external server.
- **Sensitive Data Exclusion:** WebCheck ignores password fields, auth tokens, cookies, and sensitive input values.
- **Deterministic Rules Only:** All diagnostics are computed locally using transparent, auditable browser APIs.
