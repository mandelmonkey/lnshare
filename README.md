# LNShare - Lightning Address Sharing PWA

A Progressive Web App that implements the LUD-22 protocol for sharing Lightning addresses via QR code scanning.

## Features

- Store your Lightning address locally
- Scan QR codes to share your address with services
- Implements full LUD-22 protocol specification
- Works offline (PWA with service worker)
- Mobile-first responsive design
- Camera-based QR code scanning

## How It Works

### LUD-22 Protocol Flow

1. A service generates a QR code containing a URL with `tag=addressRequest` and a random `k1` parameter
2. User scans the QR code with LNShare
3. LNShare makes a GET request to retrieve the request details (callback URL, metadata)
4. User confirms they want to share their Lightning address
5. LNShare POSTs the address and k1 to the callback URL
6. Service receives the Lightning address

## Setup

### Running Locally

Since this is a PWA that requires HTTPS and camera access, you need to serve it over HTTPS or localhost:

**Option 1: Using Python (localhost)**
```bash
# Python 3
python3 -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

Then visit: `http://localhost:8000`

**Option 2: Using Node.js http-server**
```bash
# Install globally
npm install -g http-server

# Run
http-server -p 8000
```

**Option 3: Using PHP**
```bash
php -S localhost:8000
```

### Camera Permissions

The app requires camera access to scan QR codes. Make sure to:
- Allow camera permissions when prompted
- Use HTTPS or localhost (required for camera access)
- Use a device with a camera

## Usage

### First Time Setup

1. Open the app
2. Enter your Lightning address (e.g., `user@wallet.com`)
3. Click "Save Address"

### Scanning QR Codes

1. Click "Scan QR Code" button
2. Point camera at a LUD-22 QR code
3. Review the request details (domain, reason)
4. Click "Share Address" to confirm or "Deny" to cancel

### Changing Your Address

1. From the main screen, click "Change Address"
2. Enter your new Lightning address
3. Click "Save Address"

## Testing

To test the app, you need a service that generates LUD-22 address requests. A test page is included (`test-server.html`) that can generate mock requests.

### Test Server Setup

1. Create a simple backend that:
   - Generates URLs with `tag=addressRequest&k1=<random_hex>`
   - Responds to GET requests with:
     ```json
     {
       "tag": "addressRequest",
       "callback": "https://yourapp.com/receive-address",
       "k1": "<same_random_hex>",
       "metadata": "Reason for requesting address"
     }
     ```
   - Accepts POST requests with:
     ```json
     {
       "k1": "<hex_value>",
       "address": "user@wallet.com"
     }
     ```
   - Responds with: `{"status": "OK"}` or `{"status": "ERROR", "reason": "..."}`

2. Generate a QR code from the request URL
3. Scan with LNShare

## Project Structure

```
LNShare/
├── index.html          # Main app HTML
├── app.js             # Application logic
├── styles.css         # Styling
├── manifest.json      # PWA manifest
├── sw.js             # Service worker
├── qr-scanner.min.js # jsQR library
└── README.md         # This file
```

## Technical Details

### Dependencies

- **jsQR**: QR code scanning library
- No other external dependencies

### Browser Support

- Modern browsers with ES6+ support
- Camera API support required
- Service Worker support for PWA features

### Storage

- Lightning address is stored in `localStorage`
- No data is sent to any server except during LUD-22 protocol flow
- All data stays on your device

### Security Considerations

- Always verify the domain requesting your address
- Only share with trusted services
- The app displays the requesting domain before you confirm
- HTTPS required for production use

## LUD-22 Specification

This app implements [LUD-22](https://github.com/mandelmonkey/luds/blob/luds/22.md), which enables services to request Lightning addresses without manual text input.

### Key Features of LUD-22

- **Reduced friction**: No typing required
- **Spam prevention**: Uses k1 parameter for request matching
- **User consent**: Always shows confirmation before sharing
- **No authentication**: Only collects public Lightning addresses

## License

MIT License - Feel free to use and modify

## Contributing

Issues and pull requests welcome!

## Support

For issues or questions about LUD-22 protocol, refer to the [specification](https://github.com/mandelmonkey/luds/blob/luds/22.md).
# lnshare
