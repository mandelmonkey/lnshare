// Simple in-memory storage for test addresses
// Note: This will reset on cold starts, but good enough for quick testing

const receivedAddresses = [];

export function addAddress(address, k1, metadata) {
  receivedAddresses.unshift({
    address,
    k1,
    metadata,
    timestamp: new Date().toISOString(),
    time: Date.now()
  });

  // Keep only last 20 addresses
  if (receivedAddresses.length > 20) {
    receivedAddresses.pop();
  }
}

export function getRecentAddresses(limit = 10) {
  return receivedAddresses.slice(0, limit);
}

export function clearAddresses() {
  receivedAddresses.length = 0;
}
