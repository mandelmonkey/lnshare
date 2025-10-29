// Vercel Serverless Function to create a new test request
// Returns a QR code URL for testing

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      status: 'ERROR',
      reason: 'Method not allowed'
    });
  }

  const metadata = req.query.metadata || 'Test request from LNShare';

  // Generate random k1
  const k1 = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Create request URL
  const baseUrl = `https://${req.headers.host}`;
  const requestUrl = `${baseUrl}/api/test/request?tag=addressRequest&k1=${k1}&metadata=${encodeURIComponent(metadata)}`;

  return res.status(200).json({
    requestUrl,
    k1,
    metadata,
    message: 'Generate a QR code from this URL and scan it with LNShare'
  });
}
