// LNShare - Lightning Address Sharing PWA
// Implements LUD-22 protocol

class LNShareApp {
  constructor() {
    this.lightningAddress = null;
    this.currentRequest = null;
    this.videoStream = null;
    this.scanningInterval = null;
    this.lastError = null;
    this.scannedUrl = null;

    this.screens = {
      setup: document.getElementById('setup-screen'),
      main: document.getElementById('main-screen'),
      scanner: document.getElementById('scanner-screen'),
      confirmation: document.getElementById('confirmation-screen'),
      result: document.getElementById('result-screen')
    };

    this.init();
  }

  init() {
    // Register service worker with update detection
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((registration) => {
        // Check for updates every 30 seconds
        setInterval(() => {
          registration.update();
        }, 30000);

        // Listen for new service worker
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available
              this.showUpdateBanner();
            }
          });
        });
      }).catch((err) => {
        console.log('Service Worker registration failed:', err);
      });

      // Listen for controller change (new SW activated)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Reload when new SW takes control
        window.location.reload();
      });
    }

    // Load saved address
    this.loadAddress();

    // Setup event listeners
    this.setupEventListeners();

    // Show appropriate screen
    if (this.lightningAddress) {
      this.showScreen('main');
    } else {
      this.showScreen('setup');
    }

    // Handle URL params (e.g., from shortcuts)
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'scan' && this.lightningAddress) {
      this.startScanning();
    }
  }

  setupEventListeners() {
    // Setup screen
    document.getElementById('save-address-btn').addEventListener('click', () => {
      this.saveAddress();
    });

    document.getElementById('lightning-address-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.saveAddress();
      }
    });

    // Main screen
    document.getElementById('scan-btn').addEventListener('click', () => {
      this.startScanning();
    });

    document.getElementById('change-address-btn').addEventListener('click', () => {
      this.changeAddress();
    });

    // Scanner screen
    document.getElementById('cancel-scan-btn').addEventListener('click', () => {
      this.stopScanning();
      this.showScreen('main');
    });

    // Confirmation screen
    document.getElementById('confirm-share-btn').addEventListener('click', () => {
      this.confirmShare();
    });

    document.getElementById('deny-share-btn').addEventListener('click', () => {
      this.denyShare();
    });

    // Result screen
    document.getElementById('done-btn').addEventListener('click', () => {
      this.showScreen('main');
    });
  }

  loadAddress() {
    const saved = localStorage.getItem('lightningAddress');
    if (saved) {
      this.lightningAddress = saved;
      document.getElementById('stored-address').textContent = saved;
    }
  }

  async saveAddress() {
    const input = document.getElementById('lightning-address-input');
    const button = document.getElementById('save-address-btn');
    const skipValidation = document.getElementById('skip-validation').checked;
    const address = input.value.trim();

    if (!this.validateLightningAddress(address)) {
      this.showError('Please enter a valid Lightning address (user@domain.com)');
      return;
    }

    // If skip validation is checked, save immediately
    if (skipValidation) {
      this.lightningAddress = address;
      localStorage.setItem('lightningAddress', address);
      document.getElementById('stored-address').textContent = address;
      this.showScreen('main');
      return;
    }

    // Show loading state
    button.disabled = true;
    button.textContent = 'Validating...';

    try {
      // Validate that the Lightning address endpoint exists
      const [username, domain] = address.split('@');
      const lnurlEndpoint = `https://${domain}/.well-known/lnurlp/${username}`;

      const response = await fetch(lnurlEndpoint, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`Cannot verify Lightning address (${response.status})`);
      }

      // Read response as text first
      const responseText = await response.text();

      // Try to parse as JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error('Lightning address endpoint did not return valid JSON');
      }

      // Basic LNURL-pay validation
      if (!data.callback || !data.minSendable || !data.maxSendable) {
        throw new Error('Lightning address endpoint returned invalid data');
      }

      // Success - save the address
      this.lightningAddress = address;
      localStorage.setItem('lightningAddress', address);
      document.getElementById('stored-address').textContent = address;
      this.showScreen('main');

    } catch (error) {
      console.error('Validation error:', error);
      this.showError(`Validation failed: ${error.message}`);
      button.disabled = false;
      button.textContent = 'Save Address';
    }
  }

  changeAddress() {
    document.getElementById('lightning-address-input').value = this.lightningAddress;
    this.showScreen('setup');
  }

  validateLightningAddress(address) {
    // Basic validation: user@domain.tld
    const regex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return regex.test(address);
  }

  async startScanning() {
    try {
      this.showScreen('scanner');

      const video = document.getElementById('scanner-video');
      const canvas = document.getElementById('scanner-canvas');
      const ctx = canvas.getContext('2d');

      // Request camera access
      this.videoStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });

      video.srcObject = this.videoStream;

      // Start scanning loop
      this.scanningInterval = setInterval(() => {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);

          if (code) {
            this.handleScannedCode(code.data);
          }
        }
      }, 300);

    } catch (error) {
      console.error('Camera error:', error);
      this.showError('Could not access camera. Please grant camera permissions.');
      this.showScreen('main');
    }
  }

  stopScanning() {
    if (this.scanningInterval) {
      clearInterval(this.scanningInterval);
      this.scanningInterval = null;
    }

    if (this.videoStream) {
      this.videoStream.getTracks().forEach(track => track.stop());
      this.videoStream = null;
    }
  }

  async handleScannedCode(data) {
    this.stopScanning();
    this.scannedUrl = data;

    try {
      // Parse the scanned URL
      let url;
      try {
        url = new URL(data);
      } catch (e) {
        this.lastError = {
          message: 'Invalid QR code: not a valid URL',
          url: data,
          details: 'The scanned QR code does not contain a valid URL'
        };
        this.showErrorWithDebug('Invalid QR code: not a valid URL');
        this.showScreen('main');
        return;
      }

      const params = new URLSearchParams(url.search);

      // Check if this is an addressRequest
      if (params.get('tag') !== 'addressRequest') {
        this.lastError = {
          message: 'This QR code is not a Lightning address request',
          url: data,
          details: `Missing or incorrect 'tag' parameter. Expected 'addressRequest', got '${params.get('tag')}'`
        };
        this.showErrorWithDebug('This QR code is not a Lightning address request');
        this.showScreen('main');
        return;
      }

      const k1 = params.get('k1');
      if (!k1) {
        this.lastError = {
          message: 'Invalid request: missing k1 parameter',
          url: data,
          details: 'The LUD-22 request is missing the required k1 parameter'
        };
        this.showErrorWithDebug('Invalid request: missing k1 parameter');
        this.showScreen('main');
        return;
      }

      // Make GET request to retrieve details
      const response = await fetch(url.toString());

      if (!response.ok) {
        const errorText = await response.text();
        this.lastError = {
          message: `Server returned ${response.status}`,
          url: url.toString(),
          details: `HTTP ${response.status}: ${errorText.substring(0, 200)}`
        };
        throw new Error(`Server returned ${response.status}`);
      }

      // Read response as text first
      const responseText = await response.text();

      // Check if response is HTML
      if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
        this.lastError = {
          message: 'Wrong URL - This is a webpage, not an API endpoint',
          url: url.toString(),
          details: 'You may have scanned a link to a webpage instead of a LUD-22 QR code. Make sure you are scanning a QR code generated by a Lightning service, not a link to a website.'
        };
        throw new Error('This appears to be a webpage, not a valid LUD-22 endpoint. Please scan a valid Lightning address request QR code.');
      }

      // Try to parse as JSON
      let requestData;
      try {
        requestData = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', responseText);
        this.lastError = {
          message: 'Server did not return valid JSON',
          url: url.toString(),
          details: `Response was: ${responseText.substring(0, 200)}`
        };
        throw new Error(`Server did not return valid JSON. Got: ${responseText.substring(0, 100)}...`);
      }

      // Validate response
      if (requestData.tag !== 'addressRequest') {
        this.lastError = {
          message: 'Invalid response: wrong tag',
          url: url.toString(),
          details: `Response: ${JSON.stringify(requestData)}`
        };
        throw new Error('Invalid response: wrong tag');
      }

      if (!requestData.callback || !requestData.k1) {
        this.lastError = {
          message: 'Invalid response: missing required fields',
          url: url.toString(),
          details: `Response: ${JSON.stringify(requestData)}`
        };
        throw new Error('Invalid response: missing required fields');
      }

      // Store request data
      this.currentRequest = {
        callback: requestData.callback,
        k1: requestData.k1,
        metadata: requestData.metadata || 'No reason provided',
        domain: new URL(requestData.callback).hostname
      };

      // Show confirmation screen
      this.showConfirmation();

    } catch (error) {
      console.error('Error processing scanned code:', error);
      if (!this.lastError) {
        this.lastError = {
          message: error.message,
          url: data,
          details: error.stack || 'No additional details'
        };
      }
      this.showErrorWithDebug(`Error: ${error.message}`);
      this.showScreen('main');
    }
  }

  showConfirmation() {
    document.getElementById('request-domain').textContent = this.currentRequest.domain;
    document.getElementById('request-metadata').textContent = this.currentRequest.metadata;
    document.getElementById('confirm-address').textContent = this.lightningAddress;
    this.showScreen('confirmation');
  }

  async copyToClipboard(text, button) {
    try {
      await navigator.clipboard.writeText(text);
      const originalText = button.textContent;
      button.textContent = '✓ Copied!';
      setTimeout(() => {
        button.textContent = originalText;
      }, 2000);
    } catch (error) {
      this.showError('Failed to copy to clipboard');
    }
  }

  showErrorWithDebug(message) {
    this.showError(message + ' (Tap to see details)');

    // Add click handler to toast to show debug info
    const toast = document.getElementById('error-toast');
    const clickHandler = () => {
      toast.removeEventListener('click', clickHandler);
      this.showDebugInfo();
    };
    toast.addEventListener('click', clickHandler);
  }

  showDebugInfo() {
    if (!this.lastError) return;

    const debugInfo = `
ERROR DETAILS
=============

Message: ${this.lastError.message}

URL: ${this.lastError.url}

Details: ${this.lastError.details}

Timestamp: ${new Date().toISOString()}
    `.trim();

    // Show in a result screen format
    const resultContent = document.getElementById('result-content');
    resultContent.innerHTML = `
      <div class="result-icon">⚠️</div>
      <div class="result-message">
        <h3>Debug Information</h3>
        <div class="debug-info">
          <pre>${debugInfo}</pre>
        </div>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="app.copyDebugInfo()">Copy Debug Info</button>
    `;
    this.showScreen('result');
  }

  async copyDebugInfo() {
    if (!this.lastError) return;

    const debugInfo = `LNShare Debug Info
==================

Error: ${this.lastError.message}
URL: ${this.lastError.url}
Details: ${this.lastError.details}
Timestamp: ${new Date().toISOString()}
User Agent: ${navigator.userAgent}`;

    try {
      await navigator.clipboard.writeText(debugInfo);
      this.showError('✓ Debug info copied to clipboard!');
    } catch (error) {
      this.showError('Failed to copy. Try selecting the text manually.');
    }
  }

  async confirmShare() {
    try {
      // Send POST request to callback
      const response = await fetch(this.currentRequest.callback, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          k1: this.currentRequest.k1,
          address: this.lightningAddress
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      // Read response as text first
      const responseText = await response.text();

      // Try to parse as JSON
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', responseText);
        throw new Error(`Server did not return valid JSON. Got: ${responseText.substring(0, 100)}...`);
      }

      if (result.status === 'OK') {
        this.showResult('success', 'Address Shared Successfully',
          `Your Lightning address was shared with ${this.currentRequest.domain}`);
      } else {
        throw new Error(result.reason || 'Unknown error');
      }

    } catch (error) {
      console.error('Error sharing address:', error);
      this.showResult('error', 'Failed to Share Address', error.message);
    }
  }

  denyShare() {
    this.currentRequest = null;
    this.showScreen('main');
  }

  showResult(type, title, message) {
    const icon = type === 'success' ? '✓' : '✗';
    const resultContent = document.getElementById('result-content');

    resultContent.innerHTML = `
      <div class="result-icon">${icon}</div>
      <div class="result-message">
        <h3>${title}</h3>
        <p>${message}</p>
      </div>
    `;

    this.showScreen('result');
    this.currentRequest = null;
  }

  showScreen(screenName) {
    Object.values(this.screens).forEach(screen => {
      screen.classList.add('hidden');
    });
    this.screens[screenName].classList.remove('hidden');
  }

  showError(message) {
    const toast = document.getElementById('error-toast');
    toast.textContent = message;
    toast.classList.remove('hidden', 'success');

    // Show longer for longer messages
    const duration = Math.max(4000, message.length * 50);

    setTimeout(() => {
      toast.classList.add('hidden');
    }, duration);
  }

  showUpdateBanner() {
    const banner = document.getElementById('update-banner');
    banner.classList.remove('hidden');
  }

  reloadApp() {
    // Tell the waiting service worker to take over
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
    } else {
      window.location.reload();
    }
  }
}

// Initialize app when DOM is ready
let app;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    app = new LNShareApp();
  });
} else {
  app = new LNShareApp();
}
