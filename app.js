// LNShare - Lightning Address Sharing PWA
// Implements LUD-22 protocol

class LNShareApp {
  constructor() {
    this.lightningAddress = null;
    this.currentRequest = null;
    this.videoStream = null;
    this.scanningInterval = null;

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
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.log('Service Worker registration failed:', err);
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

  saveAddress() {
    const input = document.getElementById('lightning-address-input');
    const address = input.value.trim();

    if (!this.validateLightningAddress(address)) {
      this.showError('Please enter a valid Lightning address (user@domain.com)');
      return;
    }

    this.lightningAddress = address;
    localStorage.setItem('lightningAddress', address);
    document.getElementById('stored-address').textContent = address;
    this.showScreen('main');
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

    try {
      // Parse the scanned URL
      const url = new URL(data);
      const params = new URLSearchParams(url.search);

      // Check if this is an addressRequest
      if (params.get('tag') !== 'addressRequest') {
        this.showError('This QR code is not a Lightning address request');
        this.showScreen('main');
        return;
      }

      const k1 = params.get('k1');
      if (!k1) {
        this.showError('Invalid request: missing k1 parameter');
        this.showScreen('main');
        return;
      }

      // Make GET request to retrieve details
      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const requestData = await response.json();

      // Validate response
      if (requestData.tag !== 'addressRequest') {
        throw new Error('Invalid response: wrong tag');
      }

      if (!requestData.callback || !requestData.k1) {
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
      this.showError(`Error: ${error.message}`);
      this.showScreen('main');
    }
  }

  showConfirmation() {
    document.getElementById('request-domain').textContent = this.currentRequest.domain;
    document.getElementById('request-metadata').textContent = this.currentRequest.metadata;
    document.getElementById('confirm-address').textContent = this.lightningAddress;
    this.showScreen('confirmation');
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

      const result = await response.json();

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

    setTimeout(() => {
      toast.classList.add('hidden');
    }, 4000);
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new LNShareApp();
  });
} else {
  new LNShareApp();
}
