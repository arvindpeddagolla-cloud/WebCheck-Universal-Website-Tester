/**
 * WebCheck Local Test Fixture Server
 * Serves static test fixtures and handles mock endpoints (e.g. 500 error, 404 route).
 * Run via: node tests/server.js [port]
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT || process.argv[2] || '3000', 10);
const BASE_DIR = path.resolve(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // Set CORS headers for local testing
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS, POST');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. Mock 500 API Endpoint for Scenario 10
  if (pathname === '/api/broken-endpoint') {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal Server Error (Simulated 500 for WebCheck verification)' }));
    return;
  }

  // 2. Mock 404 Route for Scenario 06
  if (pathname === '/missing-page-404-broken' || pathname === '/missing-page-404') {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found (Simulated missing route for WebCheck link verification)');
    return;
  }

  // 3. Static File Serving
  let filePath = '';
  if (pathname === '/' || pathname === '/tests' || pathname === '/tests/') {
    filePath = path.join(BASE_DIR, 'tests', 'fixture.html');
  } else if (pathname.startsWith('/tests/')) {
    filePath = path.join(BASE_DIR, pathname);
  } else {
    // Check in workspace root first, then tests/
    const candidateRoot = path.join(BASE_DIR, pathname);
    if (fs.existsSync(candidateRoot) && fs.statSync(candidateRoot).isFile()) {
      filePath = candidateRoot;
    } else {
      filePath = path.join(BASE_DIR, 'tests', pathname);
    }
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`404 Not Found: ${pathname}`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    if (req.method === 'HEAD') {
      res.end();
    } else {
      fs.createReadStream(filePath).pipe(res);
    }
  });
});

server.listen(PORT, () => {
  console.log(`[WebCheck Test Server] Running at http://localhost:${PORT}/tests/fixture.html`);
  console.log(`[WebCheck Test Server] Press Ctrl+C to stop.`);
});
