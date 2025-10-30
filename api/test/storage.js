// Simple in-memory storage for test addresses
// Note: This will reset on cold starts, but good enough for quick testing
// Using global to persist across module instances in the same serverless function

// Use globalThis to ensure we're using the same storage across imports
if (!globalThis.__lnshareStorage) {
  globalThis.__lnshareStorage = [];
}

export function addAddress(address, k1, metadata) {
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

export function getRecentAddresses(limit = 10) {
  console.log('Getting recent addresses, storage has', globalThis.__lnshareStorage.length, 'addresses');
  return globalThis.__lnshareStorage.slice(0, limit);
}

export function clearAddresses() {
  globalThis.__lnshareStorage.length = 0;
}
