// Vercel Serverless Function for LUD-22 test endpoint
// This endpoint handles both GET (address request) and POST (receive address)

// In-memory storage (will reset on each cold start, but good enough for testing)
const activeRequests = new Map();

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET request - return request details for LUD-22
  if (req.method === 'GET') {
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

    // Store this request
    activeRequests.set(k1, {
      metadata: metadata || 'Test request from LNShare',
      timestamp: Date.now()
    });

    // Return LUD-22 address request response
    const baseUrl = `https://${req.headers.host}`;
    return res.status(200).json({
      tag: 'addressRequest',
      callback: `${baseUrl}/api/test/callback`,
      k1: k1,
      metadata: metadata || 'Test request from LNShare'
    });
  }

  // Other methods not allowed
  return res.status(405).json({
    status: 'ERROR',
    reason: 'Method not allowed'
  });
}
