# Frontend API Documentation

## Base URL
```
http://localhost:5000/api
```

## Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Device Management APIs

### 1. Generate Pairing Code
**Endpoint:** `POST /devices/pairing-code`

**Description:** Generate a 6-digit pairing code for device registration (Admin only)

**Request:**
```json
{
  "type": "vr"  // or "chair"
}
```

**Response:**
```json
{
  "status": true,
  "data": {
    "code": "123456",
    "expiresAt": "2024-10-04T16:30:00Z"
  }
}
```

**Frontend Usage:**
```javascript
const generatePairingCode = async (deviceType) => {
  const response = await fetch('/api/devices/pairing-code', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ type: deviceType })
  });
  return response.json();
};
```

### 2. Register Device
**Endpoint:** `POST /devices/register`

**Description:** Register a device using pairing code (Device/User interface)

**Request:**
```json
{
  "type": "vr",
  "code": "123456",
  "deviceId": "vr_headset_001",
  "name": "My VR Headset",
  "metadata": {
    "model": "Quest 3",
    "firmware": "v2.1.0"
  }
}
```

**Response:**
```json
{
  "status": true,
  "data": {
    "id": "uuid-here",
    "code": "789012",
    "deviceId": "vr_headset_001",
    "name": "VR #001",
    "registeredAt": "2024-10-04T16:25:00Z"
  }
}
```

### 3. List Registered Devices
**Endpoint:** `GET /devices`

**Description:** Get all registered devices

**Response:**
```json
{
  "status": true,
  "data": {
    "vr": [
      {
        "id": "uuid-1",
        "code": "789012",
        "deviceId": "vr_headset_001",
        "name": "VR #001",
        "lastSeenAt": "2024-10-04T16:25:00Z",
        "metadata": {...}
      }
    ],
    "chairs": [
      {
        "id": "uuid-2",
        "code": "456789",
        "deviceId": "chair_001",
        "name": "Chair #001",
        "lastSeenAt": "2024-10-04T16:20:00Z",
        "metadata": {...}
      }
    ]
  }
}
```

### 4. Discover Devices
**Endpoint:** `POST /devices/discover`

**Description:** Scan for available devices on the network

**Response:**
```json
{
  "status": true,
  "message": "Device scan initiated",
  "requestId": "abc123def"
}
```

### 5. Get Discovered Devices
**Endpoint:** `GET /devices/discovered`

**Description:** Get list of currently discovered devices

**Response:**
```json
{
  "status": true,
  "data": [
    {
      "deviceId": "vr_headset_001",
      "type": "vr",
      "name": "VR Headset #1",
      "isRegistered": true,
      "lastSeen": "2024-10-04T16:25:00Z",
      "discoveredAt": "2024-10-04T16:20:00Z",
      "metadata": {
        "model": "Quest 3",
        "battery": 85,
        "status": "idle"
      }
    }
  ]
}
```

### 6. Send Command to Device
**Endpoint:** `POST /devices/{deviceId}/command`

**Description:** Send a command to a specific device

**Request:**
```json
{
  "command": "start",
  "payload": {
    "session_id": "session_123",
    "journey_id": "journey_456"
  }
}
```

**Available Commands:**
- `start` - Start device/session
- `stop` - Stop device/session
- `calibrate` - Calibrate device
- `reset` - Reset device
- `status` - Request status update

**Response:**
```json
{
  "status": true,
  "message": "Command sent",
  "requestId": "xyz789abc"
}
```

## WebSocket Events

Connect to Socket.IO for real-time updates:

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000');

// Device discovered
socket.on('device:discovered', (data) => {
  console.log('New device found:', data);
  // Update UI with new device
});

// Device heartbeat
socket.on('device:heartbeat', (data) => {
  console.log('Device heartbeat:', data);
  // Update device status in UI
});

// Device status update
socket.on('device:status', (data) => {
  console.log('Device status changed:', data);
  // Update device status in UI
});

// Device went offline
socket.on('device:offline', (data) => {
  console.log('Device offline:', data);
  // Mark device as offline in UI
});
```

## Frontend Implementation Examples

### React Component for Device Discovery

```jsx
import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

const DeviceManager = () => {
  const [devices, setDevices] = useState([]);
  const [discoveredDevices, setDiscoveredDevices] = useState([]);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io('http://localhost:5000');
    setSocket(newSocket);

    // Listen for device events
    newSocket.on('device:discovered', (device) => {
      setDiscoveredDevices(prev => {
        const existing = prev.find(d => d.deviceId === device.deviceId);
        if (existing) {
          return prev.map(d => d.deviceId === device.deviceId ? device : d);
        }
        return [...prev, device];
      });
    });

    newSocket.on('device:offline', (device) => {
      setDiscoveredDevices(prev => 
        prev.filter(d => d.deviceId !== device.deviceId)
      );
    });

    return () => newSocket.close();
  }, []);

  const scanForDevices = async () => {
    try {
      const response = await fetch('/api/devices/discover', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const result = await response.json();
      console.log('Scan initiated:', result.requestId);
    } catch (error) {
      console.error('Scan failed:', error);
    }
  };

  const sendCommand = async (deviceId, command, payload = {}) => {
    try {
      const response = await fetch(`/api/devices/${deviceId}/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ command, payload })
      });
      const result = await response.json();
      console.log('Command sent:', result);
    } catch (error) {
      console.error('Command failed:', error);
    }
  };

  return (
    <div>
      <h2>Device Manager</h2>
      
      <button onClick={scanForDevices}>
        Scan for Devices
      </button>

      <h3>Discovered Devices</h3>
      {discoveredDevices.map(device => (
        <div key={device.deviceId} className="device-card">
          <h4>{device.name}</h4>
          <p>Type: {device.type}</p>
          <p>Status: {device.isRegistered ? 'Registered' : 'Not Registered'}</p>
          <p>Last Seen: {new Date(device.lastSeen).toLocaleString()}</p>
          
          <div className="device-controls">
            <button onClick={() => sendCommand(device.deviceId, 'start')}>
              Start
            </button>
            <button onClick={() => sendCommand(device.deviceId, 'stop')}>
              Stop
            </button>
            <button onClick={() => sendCommand(device.deviceId, 'calibrate')}>
              Calibrate
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default DeviceManager;
```

### Vue.js Component Example

```vue
<template>
  <div class="device-manager">
    <h2>Device Manager</h2>
    
    <button @click="scanForDevices" class="scan-btn">
      Scan for Devices
    </button>

    <div class="devices-grid">
      <div 
        v-for="device in discoveredDevices" 
        :key="device.deviceId"
        class="device-card"
      >
        <h3>{{ device.name }}</h3>
        <p>Type: {{ device.type }}</p>
        <p>Status: {{ device.isRegistered ? 'Registered' : 'Not Registered' }}</p>
        
        <div class="device-controls">
          <button @click="sendCommand(device.deviceId, 'start')">Start</button>
          <button @click="sendCommand(device.deviceId, 'stop')">Stop</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import io from 'socket.io-client';

export default {
  name: 'DeviceManager',
  data() {
    return {
      discoveredDevices: [],
      socket: null
    };
  },
  mounted() {
    this.initSocket();
  },
  beforeUnmount() {
    if (this.socket) {
      this.socket.disconnect();
    }
  },
  methods: {
    initSocket() {
      this.socket = io('http://localhost:5000');
      
      this.socket.on('device:discovered', (device) => {
        const index = this.discoveredDevices.findIndex(d => d.deviceId === device.deviceId);
        if (index >= 0) {
          this.discoveredDevices.splice(index, 1, device);
        } else {
          this.discoveredDevices.push(device);
        }
      });

      this.socket.on('device:offline', (device) => {
        this.discoveredDevices = this.discoveredDevices.filter(
          d => d.deviceId !== device.deviceId
        );
      });
    },
    
    async scanForDevices() {
      try {
        const response = await fetch('/api/devices/discover', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.$store.state.auth.token}`
          }
        });
        const result = await response.json();
        console.log('Scan initiated:', result.requestId);
      } catch (error) {
        console.error('Scan failed:', error);
      }
    },

    async sendCommand(deviceId, command, payload = {}) {
      try {
        const response = await fetch(`/api/devices/${deviceId}/command`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.$store.state.auth.token}`
          },
          body: JSON.stringify({ command, payload })
        });
        const result = await response.json();
        console.log('Command sent:', result);
      } catch (error) {
        console.error('Command failed:', error);
      }
    }
  }
};
</script>
```

## Error Handling

All API endpoints return consistent error responses:

```json
{
  "status": false,
  "message": "Error description here"
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad Request (validation error)
- `401` - Unauthorized (invalid/missing token)
- `404` - Not Found
- `500` - Internal Server Error

## Rate Limiting

- Device discovery: Max 1 request per 5 seconds
- Command sending: Max 10 requests per minute per device
- Pairing code generation: Max 5 requests per minute

## Best Practices

1. **Always handle Socket.IO disconnections**
2. **Implement proper error handling for all API calls**
3. **Cache device lists and update incrementally**
4. **Show loading states during API calls**
5. **Validate user input before sending commands**
6. **Use debouncing for frequent operations**
7. **Implement proper cleanup in component unmount**
