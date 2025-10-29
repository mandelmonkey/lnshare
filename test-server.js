// Simple test server for LUD-22 protocol testing
// Run with: node test-server.js

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 8000;

// Store active requests (k1 -> request data)
const activeRequests = new Map();

// MIME types
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function generateK1() {
  return crypto.randomBytes(32).toString('hex');
}

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // LUD-22 endpoint: Generate address request
  if (pathname === '/create-request' && req.method === 'GET') {
    const k1 = generateK1();
    const metadata = url.searchParams.get('metadata') || 'Test request from LNShare test server';

    activeRequests.set(k1, {
      callback: `http://localhost:${PORT}/receive-address`,
      metadata,
      timestamp: Date.now()
    });

    // Clean up old requests (older than 5 minutes)
    for (const [key, value] of activeRequests.entries()) {
      if (Date.now() - value.timestamp > 5 * 60 * 1000) {
        activeRequests.delete(key);
      }
    }

    const requestUrl = `http://localhost:${PORT}/address-request?tag=addressRequest&k1=${k1}`;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      requestUrl,
      k1,
      qrData: requestUrl,
      message: 'Scan this URL with LNShare'
    }));
    return;
  }

  // LUD-22 endpoint: Handle address request (GET)
  if (pathname === '/address-request' && req.method === 'GET') {
    const tag = url.searchParams.get('tag');
    const k1 = url.searchParams.get('k1');

    if (tag !== 'addressRequest' || !k1) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ERROR', reason: 'Invalid parameters' }));
      return;
    }

    const requestData = activeRequests.get(k1);
    if (!requestData) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ERROR', reason: 'Request not found or expired' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      tag: 'addressRequest',
      callback: requestData.callback,
      k1,
      metadata: requestData.metadata
    }));
    return;
  }

  // LUD-22 endpoint: Receive address (POST)
  if (pathname === '/receive-address' && req.method === 'POST') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const { k1, address } = data;

        if (!k1 || !address) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ERROR', reason: 'Missing k1 or address' }));
          return;
        }

        const requestData = activeRequests.get(k1);
        if (!requestData) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ERROR', reason: 'Invalid or expired k1' }));
          return;
        }

        // Validate Lightning address format
        if (!/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(address)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ERROR', reason: 'Invalid Lightning address format' }));
          return;
        }

        // Success!
        console.log(`\n✅ Received Lightning Address: ${address}`);
        console.log(`   Metadata: ${requestData.metadata}`);
        console.log(`   Time: ${new Date().toLocaleString()}\n`);

        activeRequests.delete(k1);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'OK' }));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ERROR', reason: 'Invalid JSON' }));
      }
    });
    return;
  }

  // Serve static files
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(__dirname, filePath);

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>', 'utf-8');
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`, 'utf-8');
      }
    } else {
      const ext = path.extname(filePath);
      const contentType = mimeTypes[ext] || 'application/octet-stream';

      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║  LNShare Test Server Running                          ║
╚═══════════════════════════════════════════════════════╝

📱 LNShare App:
   http://localhost:${PORT}/

🧪 Test Generator:
   http://localhost:${PORT}/test-generator.html

🔗 API Endpoints:
   GET  /create-request         - Generate new request
   GET  /address-request        - LUD-22 request endpoint
   POST /receive-address        - LUD-22 callback endpoint

📋 Example: Create test request
   curl http://localhost:${PORT}/create-request

Press Ctrl+C to stop the server
`);
});
