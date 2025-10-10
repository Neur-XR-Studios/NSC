# Device Integration Guide

## Overview

This system uses a **hybrid MQTT + API approach** for device pairing and detection, combining the benefits of real-time communication with secure registration processes.

## Architecture

### 1. Device Discovery (MQTT-based)
- **Real-time device detection**
- **Automatic heartbeat monitoring**
- **Live status updates**
- **Command/control messaging**

### 2. Device Registration (API-based)
- **Secure pairing with codes**
- **Persistent device management**
- **User-controlled registration**

## MQTT Topic Structure

```
devices/
├── discovery/
│   ├── announce          # Devices announce themselves
│   └── scan             # Backend requests device scan
├── {deviceId}/
│   ├── heartbeat        # Regular health checks
│   ├── status           # Status updates
│   └── commands/
│       ├── start        # Start device
│       ├── stop         # Stop device
│       ├── calibrate    # Calibrate device
│       └── reset        # Reset device
```

## Device Implementation Guide

### For VR/Chair Device Developers

#### 1. Device Announcement
When your device starts up, announce yourself:

```javascript
// MQTT Topic: devices/discovery/announce
{
  "deviceId": "vr_headset_001",
  "type": "vr",           // or "chair"
  "name": "VR Headset #1",
  "metadata": {
    "model": "Quest 3",
    "firmware": "v2.1.0",
    "capabilities": ["tracking", "audio", "haptic"]
  },
  "timestamp": "2024-10-04T16:20:00Z"
}
```

#### 2. Heartbeat Messages
Send regular heartbeats (every 15-20 seconds):

```javascript
// MQTT Topic: devices/{deviceId}/heartbeat
{
  "timestamp": "2024-10-04T16:20:15Z",
  "battery": 85,
  "temperature": 42.5,
  "status": "idle"
}
```

#### 3. Status Updates
Send status when something changes:

```javascript
// MQTT Topic: devices/{deviceId}/status
{
  "status": "active",
  "session_id": "session_123",
  "user_id": "user_456",
  "timestamp": "2024-10-04T16:20:30Z"
}
```

#### 4. Listen for Commands
Subscribe to command topics:

```javascript
// MQTT Topic: devices/{deviceId}/commands/+
// Handle commands like start, stop, calibrate, reset
```

## API Endpoints

### Device Registration Flow

#### 1. Generate Pairing Code
```http
POST /api/devices/pairing-code
Content-Type: application/json

{
  "type": "vr"  // or "chair"
}

Response:
{
  "status": true,
  "data": {
    "code": "123456",
    "expiresAt": "2024-10-04T16:30:00Z"
  }
}
```

#### 2. Register Device with Code
```http
POST /api/devices/register
Content-Type: application/json

{
  "type": "vr",
  "code": "123456",
  "deviceId": "vr_headset_001",
  "name": "VR Headset #1",
  "metadata": {
    "model": "Quest 3",
    "firmware": "v2.1.0"
  }
}

Response:
{
  "status": true,
  "data": {
    "id": "uuid-here",
    "code": "789012",  // permanent 6-digit code
    "deviceId": "vr_headset_001",
    "name": "VR #001",
    "registeredAt": "2024-10-04T16:25:00Z"
  }
}
```

### Device Discovery & Control

#### 1. Scan for Devices
```http
POST /api/devices/discover

Response:
{
  "status": true,
  "message": "Device scan initiated",
  "requestId": "abc123def"
}
```

#### 2. Get Discovered Devices
```http
GET /api/devices/discovered

Response:
{
  "status": true,
  "data": [
    {
      "deviceId": "vr_headset_001",
      "type": "vr",
      "name": "VR Headset #1",
      "isRegistered": true,
      "lastSeen": "2024-10-04T16:25:00Z",
      "metadata": {...}
    }
  ]
}
```

#### 3. Send Command to Device
```http
POST /api/devices/{deviceId}/command
Content-Type: application/json

{
  "command": "start",
  "payload": {
    "session_id": "session_123",
    "journey_id": "journey_456"
  }
}

Response:
{
  "status": true,
  "message": "Command sent",
  "requestId": "xyz789abc"
}
```

## WebSocket Events

The system emits real-time events via Socket.IO:

```javascript
// Device discovered
socket.on('device:discovered', (data) => {
  console.log('New device found:', data);
});

// Device heartbeat
socket.on('device:heartbeat', (data) => {
  console.log('Device heartbeat:', data);
});

// Device status update
socket.on('device:status', (data) => {
  console.log('Device status:', data);
});

// Device went offline
socket.on('device:offline', (data) => {
  console.log('Device offline:', data);
});
```

## Environment Configuration

Add these to your `.env` file:

```bash
# MQTT Configuration
MQTT_URL=mqtt://localhost:1883
MQTT_CLIENT_ID_PREFIX=nsc-backend
MQTT_USERNAME=
MQTT_PASSWORD=
MQTT_KEEPALIVE=60
MQTT_RECONNECT_MS=2000
MQTT_PROTOCOL_VERSION=5
MQTT_CLEAN=true
MQTT_WS_PATH=
```

## Recommended Device Pairing Flow

### For End Users:

1. **Admin generates pairing code** via web interface
2. **Display code** on screen (valid for 10 minutes)
3. **Device scans QR code** or user enters code manually
4. **Device registers** itself using the code
5. **System confirms** registration and assigns permanent code
6. **Device starts** sending heartbeats and status updates

### For Developers:

1. **Device announces** itself on startup
2. **Backend detects** device via MQTT
3. **User initiates pairing** through web interface
4. **Device completes registration** with generated code
5. **System tracks** device status and health

## Best Practices

### Device Implementation:
- Always send heartbeats every 15-20 seconds
- Handle network disconnections gracefully
- Implement proper error handling for MQTT messages
- Use unique, persistent device IDs
- Include relevant metadata in announcements

### Backend Integration:
- Monitor device timeouts (30-second default)
- Log all device interactions
- Validate all incoming MQTT messages
- Handle device reconnections properly
- Implement proper cleanup on shutdown

## Troubleshooting

### Common Issues:

1. **Device not discovered**
   - Check MQTT broker connection
   - Verify topic structure
   - Ensure device is sending announcements

2. **Heartbeat timeouts**
   - Check network connectivity
   - Verify heartbeat interval (should be < 30s)
   - Monitor MQTT connection stability

3. **Registration failures**
   - Verify pairing code is valid and not expired
   - Check device ID uniqueness
   - Ensure proper payload format

### Debug Commands:

```bash
# Test MQTT connection
mosquitto_pub -h localhost -t "devices/discovery/announce" -m '{"deviceId":"test","type":"vr"}'

# Monitor MQTT traffic
mosquitto_sub -h localhost -t "devices/#" -v
```
