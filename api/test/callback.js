// Vercel Serverless Function for LUD-22 callback endpoint
// This receives the POST request with the Lightning address

import { addAddress } from './storage.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only POST allowed
  if (req.method !== 'POST') {
    return res.status(405).json({
      status: 'ERROR',
      reason: 'Method not allowed'
    });
  }

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

  // Return success
  return res.status(200).json({
    status: 'OK'
  });
}
