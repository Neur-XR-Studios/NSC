# Testing Setup Guide

## Quick Start

### 1. Install MQTT Broker (if not already installed)
```bash
# On macOS
brew install mosquitto

# Start MQTT broker
mosquitto -p 1883 -v
```

### 2. Configure Environment
Make sure your `.env` file has these settings:
```bash
NODE_ENV=development
PORT=5000
MQTT_URL=mqtt://localhost:1883
MQTT_CLIENT_ID_PREFIX=nsc-backend
```

### 3. Start Backend Server
```bash
npm run dev
```

### 4. Test CORS Fix
The server should now show:
```
SERVER
Listening to port 5000
[MQTT] Connecting...
[MQTT] Connected
```

### 5. Open Test Files
- **Admin Panel**: Open `test-admin.html` in your browser
- **User Interface**: Open `test-user.html` in your browser

## Testing Workflow

### Step 1: Test Connection
1. Open `test-admin.html`
2. Click "Connect" (should show "Connected" in top-right)
3. Check activity log for connection success

### Step 2: Generate Pairing Code
1. Select device type (VR or Chair)
2. Click "Generate Code"
3. Note the 6-digit code displayed

### Step 3: Register Device
1. Open `test-user.html` in another tab/window
2. Connect to server
3. Select device type
4. Fill in device information
5. Enter the pairing code from Step 2
6. Click "Register Device"

### Step 4: Test Device Discovery
1. In `test-user.html`, use the Device Simulator section
2. Enter a device ID (e.g., "test_vr_001")
3. Click "Announce Device"
4. Switch to `test-admin.html`
5. Click "Scan for Devices"
6. You should see the device appear in the discovered devices list

### Step 5: Test Device Commands
1. In admin panel, find your discovered device
2. Click "Start", "Stop", or "Calibrate" buttons
3. Check activity log for command confirmations

## Troubleshooting

### CORS Issues Fixed
- ✅ Development mode now allows all origins
- ✅ Socket.IO configured for cross-origin requests
- ✅ HTML files can connect from file:// protocol

### If Still Getting CORS Errors:
1. Make sure `NODE_ENV=development` in your `.env`
2. Restart the server after making changes
3. Clear browser cache and reload test pages

### MQTT Connection Issues:
1. Ensure Mosquitto is running: `ps aux | grep mosquitto`
2. Test MQTT manually: `mosquitto_pub -h localhost -t test -m "hello"`
3. Check server logs for MQTT connection status

### Socket.IO Connection Issues:
1. Check browser console for detailed error messages
2. Verify server is running on correct port
3. Try connecting to `http://localhost:5000` directly in browser

## Manual Testing Commands

### Test MQTT Broker
```bash
# Terminal 1 - Subscribe to all device topics
mosquitto_sub -h localhost -t "devices/#" -v

# Terminal 2 - Publish test message
mosquitto_pub -h localhost -t "devices/discovery/announce" -m '{"deviceId":"test","type":"vr","name":"Test Device"}'
```

### Test API Endpoints
```bash
# Generate pairing code
curl -X POST http://localhost:5000/api/devices/pairing-code \
  -H "Content-Type: application/json" \
  -d '{"type":"vr"}'

# Get discovered devices
curl http://localhost:5000/api/devices/discovered
```

## Expected Behavior

### Successful Connection:
- Admin panel shows "Connected" status
- Activity log shows connection messages
- No CORS errors in browser console

### Device Registration:
- Pairing code generated successfully
- Device registration completes with permanent code
- Device appears in registered devices list

### Device Discovery:
- Simulated devices appear in discovered list
- Real-time updates via WebSocket
- Heartbeat messages logged in admin panel

### Command Sending:
- Commands sent successfully with request IDs
- MQTT messages published to device topics
- Activity logged in admin panel

## Next Steps

Once testing is working:
1. Share `FRONTEND_API_DOCS.md` with frontend developers
2. Use the HTML files as reference implementations
3. Implement proper authentication in production
4. Configure production CORS settings
5. Set up proper MQTT broker for production
