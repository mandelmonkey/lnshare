// Unified test endpoint - all routes in one function to share memory
// This ensures storage persists across different route calls

// Use globalThis to persist storage across invocations
if (!globalThis.__lnshareStorage) {
  globalThis.__lnshareStorage = [];
}

function addAddress(address, k1, metadata) {
  console.log('Adding address to storage:', address);

  globalThis.__lnshareStorage.unshift({
    address,
    k1,
    metadata,
    timestamp: new Date().toISOString(),
    time: Date.now()
  });

  // Keep only last 20 addresses
  if (globalThis.__lnshareStorage.length > 20) {
    globalThis.__lnshareStorage.pop();
  }

  console.log('Storage now has', globalThis.__lnshareStorage.length, 'addresses');
}

function getRecentAddresses(limit = 10) {
  console.log('Getting recent addresses, storage has', globalThis.__lnshareStorage.length, 'addresses');
  return globalThis.__lnshareStorage.slice(0, limit);
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const route = req.query.route;

  // Helper to get base URL without www
  const getBaseUrl = () => {
    const host = req.headers.host.replace(/^www\./, '');
    return `https://${host}`;
  };

  // Route: /api/test?route=create - Generate new test request
  if (route === 'create' && req.method === 'GET') {
    const metadata = req.query.metadata || 'Test request from LNShare';

    // Generate random k1
    const k1 = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Create request URL
    const baseUrl = getBaseUrl();
    const requestUrl = `${baseUrl}/api/test?route=request&tag=addressRequest&k1=${k1}&metadata=${encodeURIComponent(metadata)}`;

    return res.status(200).json({
      requestUrl,
      k1,
      metadata,
      message: 'Generate a QR code from this URL and scan it with LNShare'
    });
  }

  // Route: /api/test?route=request - Handle LUD-22 address request (GET)
  if (req.query.route === 'request' && req.method === 'GET') {
    const { tag, k1, metadata } = req.query;

    if (tag !== 'addressRequest') {
      return res.status(400).json({
        status: 'ERROR',
        reason: 'Invalid tag parameter'
      });
    }

    if (!k1) {
      return res.status(400).json({
        status: 'ERROR',
        reason: 'Missing k1 parameter'
      });
    }

    // Return LUD-22 address request response
    const baseUrl = getBaseUrl();
    return res.status(200).json({
      tag: 'addressRequest',
      callback: `${baseUrl}/api/test?route=callback`,
      k1: k1,
      metadata: metadata || 'Test request from LNShare'
    });
  }

  // Route: /api/test?route=callback - Receive Lightning address (POST)
  if (req.query.route === 'callback' && req.method === 'POST') {
    const { k1, address } = req.body;

    if (!k1 || !address) {
      return res.status(400).json({
        status: 'ERROR',
        reason: 'Missing k1 or address parameter'
      });
    }

    // Validate Lightning address format
    const lightningAddressRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!lightningAddressRegex.test(address)) {
      return res.status(400).json({
        status: 'ERROR',
        reason: 'Invalid Lightning address format'
      });
    }

    // Store the address
    addAddress(address, k1, 'Test request');

    // Log to console (visible in Vercel logs)
    console.log('✅ Received Lightning Address:', address, 'k1:', k1);
    console.log('Storage after adding:', globalThis.__lnshareStorage.length, 'addresses');

    // Return success
    return res.status(200).json({
      status: 'OK'
    });
  }

  // Route: /api/test?route=received - Get received addresses
  if (route === 'received' && req.method === 'GET') {
    const limit = parseInt(req.query.limit) || 10;
    const addresses = getRecentAddresses(limit);

    console.log(`Received request for addresses. Storage has ${addresses.length} addresses:`, addresses);

    return res.status(200).json({
      addresses: addresses.map(item => ({
        address: item.address,
        k1: item.k1,
        timestamp: item.timestamp,
        time: item.time // Make sure we include the numeric timestamp
      })),
      count: addresses.length
    });
  }

  // 404 for unknown routes
  return res.status(404).json({
    error: 'Not found',
    route: route,
    availableRoutes: ['create', 'request', 'callback', 'received'],
    hint: 'Use ?route=<routeName>'
  });
}
