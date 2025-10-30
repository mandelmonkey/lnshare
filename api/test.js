// Unified test endpoint - all routes in one function
// Uses Upstash Redis for persistent storage across instances

import { Redis } from '@upstash/redis';

const STORAGE_KEY = 'lnshare:addresses';
const MAX_ADDRESSES = 20;

// Initialize Redis only if credentials are provided
let redis = null;
let useInMemoryFallback = false;

// Support both naming conventions
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

if (REDIS_URL && REDIS_TOKEN) {
  redis = new Redis({
    url: REDIS_URL,
    token: REDIS_TOKEN,
  });
  console.log('✅ Upstash Redis initialized with URL:', REDIS_URL);
} else {
  console.warn('⚠️ Redis credentials not set. Looking for KV_REST_API_URL/KV_REST_API_TOKEN or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN. Using in-memory fallback (not persistent).');
  console.warn('Available env vars:', Object.keys(process.env).filter(k => k.includes('REDIS') || k.includes('KV')));
  useInMemoryFallback = true;
}

// Fallback in-memory storage (not persistent across instances)
if (!globalThis.__lnshareStorage) {
  globalThis.__lnshareStorage = [];
}

async function addAddress(address, k1, metadata) {
  const newAddress = {
    address,
    k1,
    metadata,
    timestamp: new Date().toISOString(),
    time: Date.now()
  };

  if (useInMemoryFallback) {
    console.log('Adding address to in-memory storage (fallback):', address);
    globalThis.__lnshareStorage.unshift(newAddress);
    if (globalThis.__lnshareStorage.length > MAX_ADDRESSES) {
      globalThis.__lnshareStorage.pop();
    }
    console.log('In-memory storage now has', globalThis.__lnshareStorage.length, 'addresses');
    return;
  }

  console.log('Adding address to Upstash Redis:', address);

  try {
    // Get existing addresses
    let addresses = await redis.get(STORAGE_KEY) || [];

    // Add new address at the beginning
    addresses.unshift(newAddress);

    // Keep only last 20 addresses
    if (addresses.length > MAX_ADDRESSES) {
      addresses = addresses.slice(0, MAX_ADDRESSES);
    }

    // Save back to Redis
    await redis.set(STORAGE_KEY, addresses);

    console.log('Redis storage now has', addresses.length, 'addresses');
  } catch (error) {
    console.error('Error adding to Redis:', error);
    throw error;
  }
}

async function getRecentAddresses(limit = 10) {
  if (useInMemoryFallback) {
    console.log('Getting addresses from in-memory storage (fallback), found', globalThis.__lnshareStorage.length, 'addresses');
    return globalThis.__lnshareStorage.slice(0, limit);
  }

  try {
    const addresses = await redis.get(STORAGE_KEY) || [];
    console.log('Getting recent addresses from Redis, found', addresses.length, 'addresses');
    return addresses.slice(0, limit);
  } catch (error) {
    console.error('Error reading from Redis:', error);
    return [];
  }
}

export default async function handler(req, res) {
  console.log('=== API Request ===');
  console.log('Method:', req.method);
  console.log('Route:', req.query.route);
  console.log('Using fallback storage:', useInMemoryFallback);

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const route = req.query.route;

  // Helper to get base URL - use the host as-is to avoid CORS issues
  const getBaseUrl = () => {
    return `https://${req.headers.host}`;
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
    console.log('Callback request body:', req.body);
    const { k1, address } = req.body;

    if (!k1 || !address) {
      console.log('ERROR: Missing k1 or address');
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
    await addAddress(address, k1, 'Test request');

    // Log to console (visible in Vercel logs)
    console.log('✅ Received Lightning Address:', address, 'k1:', k1);

    // Return success
    return res.status(200).json({
      status: 'OK'
    });
  }

  // Route: /api/test?route=received - Get received addresses
  if (route === 'received' && req.method === 'GET') {
    const limit = parseInt(req.query.limit) || 10;
    const addresses = await getRecentAddresses(limit);

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
