# Quick Start Guide

Get your LNShare PWA up and running in 3 minutes!

## Step 1: Start the Test Server

```bash
cd /Users/christianmoss/Documents/NodeApps/LNShare
node test-server.js
```

You should see:
```
╔═══════════════════════════════════════════════════════╗
║  LNShare Test Server Running                          ║
╚═══════════════════════════════════════════════════════╝

📱 LNShare App:
   http://localhost:8000/

🧪 Test Generator:
   http://localhost:8000/test-generator.html
```

## Step 2: Open LNShare

Open your browser and go to:
```
http://localhost:8000/
```

Enter your Lightning address (e.g., `user@getalby.com`) and click **Save Address**.

## Step 3: Generate a Test QR Code

Open another browser tab and go to:
```
http://localhost:8000/test-page.html
```

The page will automatically generate a test QR code for you!

## Step 4: Test the Full Flow

### On Desktop (Two Browser Windows):

1. Open LNShare in one window: `http://localhost:8000/`
2. Open test page in another: `http://localhost:8000/test-page.html`
3. In LNShare, click **Scan QR Code**
4. Grant camera permission
5. Point your camera at the QR code on the test page
6. Review the request details
7. Click **Share Address**
8. Check the test server console - you'll see your address received!

### On Mobile:

1. Make sure your mobile device is on the same network as your computer
2. Find your computer's local IP address:
   - Mac/Linux: `ifconfig | grep inet`
   - Windows: `ipconfig`
3. Open `http://YOUR_IP_ADDRESS:8000` on your mobile device
4. Follow the same steps as desktop

## Troubleshooting

### Camera Not Working?
- Make sure you granted camera permissions
- Use HTTPS or localhost (required for camera access)
- Try a different browser (Chrome/Safari work best)

### QR Code Not Scanning?
- Ensure good lighting
- Hold the camera steady and at the right distance
- Make sure the QR code is fully visible in the scanner box

### Server Won't Start?
- Check if port 8000 is already in use: `lsof -i :8000`
- Kill the process or change the port in `test-server.js`

## What's Happening Behind the Scenes?

1. **QR Generation**: Test server creates a unique request with a random `k1` value
2. **Scan**: LNShare scans the QR code and extracts the URL
3. **GET Request**: LNShare makes a GET request to retrieve request details
4. **User Confirmation**: You see the domain and reason for the request
5. **POST Callback**: When you confirm, LNShare POSTs your address to the callback URL
6. **Success**: Server receives your Lightning address and responds with `{"status": "OK"}`

## Next Steps

- **Deploy to Production**: Use HTTPS and a real domain
- **Integrate with Your App**: Replace test server with your own backend
- **Customize**: Edit styles, add features, make it your own!

## Need Help?

Check out the full [README.md](README.md) for detailed documentation.
