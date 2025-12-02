# Pure MQTT Architecture - Complete Flow

## Overview
Replace Socket.IO bridge with direct MQTT over WebSocket connections for all clients (React Admin, Unity, HTML simulators).

---

## Prerequisites

### 1. MQTT Broker Configuration
Your MQTT broker (Mosquitto/EMQX) must support **WebSocket** connections.

**Mosquitto config** (`mosquitto.conf`):
```conf
# Standard MQTT
listener 1883
protocol mqtt

# WebSocket for browsers
listener 9001
protocol websocket

# Optional: Secure WebSocket
listener 9002
protocol websocket
cafile /path/to/ca.crt
certfile /path/to/server.crt
keyfile /path/to/server.key
```

Restart broker: `mosquitto -c mosquitto.conf`

---

## Architecture Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      MQTT Broker                            │
│              (Mosquitto/EMQX on port 9001)                  │
│                                                             │
│  Topics:                                                    │
│  • devices/discovery/announce                               │
│  • devices/{id}/status (retained)                           │
│  • devices/{id}/heartbeat                                   │
│  • devices/{id}/events                                      │
│  • devices/{id}/commands/{cmd}                              │
│  • devices/{id}/lwt (Last Will Testament)                   │
│  • sessions/{id}/commands/{cmd}                             │
│  • admin/devices/snapshot (retained)                        │
└─────────────────────────────────────────────────────────────┘
         ↑                    ↑                    ↑
         │                    │                    │
    MQTT.js              Native MQTT         MQTT over WS
         │                    │                    │
┌────────┴────────┐  ┌────────┴────────┐  ┌────────┴────────┐
│  React Admin    │  │  Unity Device   │  │  HTML Simulator │
│  (Browser)      │  │  (C# Client)    │  │  (Browser)      │
│                 │  │                 │  │                 │
│  ws://broker    │  │  tcp://broker   │  │  ws://broker    │
│  :9001          │  │  :1883          │  │  :9001          │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## Device Connection Flow

### 1. **Device Connects** (Unity/HTML)

**Step 1:** Connect to MQTT broker
```javascript
// Browser (MQTT.js)
const client = mqtt.connect('ws://localhost:9001', {
  clientId: 'VR_12345',
  clean: false, // Persistent session
  will: {
    topic: 'devices/VR_12345/lwt',
    payload: JSON.stringify({ deviceId: 'VR_12345', status: 'offline', timestamp: new Date().toISOString() }),
    qos: 1,
    retain: true
  }
});
```

**Step 2:** On connect, publish discovery announcement
```javascript
client.on('connect', () => {
  // Announce presence
  client.publish('devices/discovery/announce', JSON.stringify({
    deviceId: 'VR_12345',
    type: 'vr',
    name: 'My VR Device',
    timestamp: new Date().toISOString()
  }), { qos: 1, retain: false });
  
  // Publish initial status (retained)
  client.publish('devices/VR_12345/status', JSON.stringify({
    deviceId: 'VR_12345',
    type: 'vr',
    status: 'idle',
    positionMs: 0,
    sessionId: '',
    timestamp: new Date().toISOString()
  }), { qos: 1, retain: true });
  
  // Subscribe to commands
  client.subscribe('devices/VR_12345/commands/+', { qos: 1 });
});
```

**Step 3:** Send heartbeats every 15 seconds
```javascript
setInterval(() => {
  client.publish('devices/VR_12345/heartbeat', JSON.stringify({
    deviceId: 'VR_12345',
    type: 'vr',
    status: 'idle',
    timestamp: new Date().toISOString()
  }), { qos: 0, retain: false });
}, 15000);
```

---

### 2. **Admin Panel Connects** (React)

**Step 1:** Connect to MQTT broker
```javascript
const adminClient = mqtt.connect('ws://localhost:9001', {
  clientId: 'admin-ABC123',
  clean: true
});
```

**Step 2:** Subscribe to all device topics
```javascript
adminClient.on('connect', () => {
  adminClient.subscribe('devices/discovery/announce', { qos: 1 });
  adminClient.subscribe('devices/+/status', { qos: 1 });
  adminClient.subscribe('devices/+/heartbeat', { qos: 0 });
  adminClient.subscribe('devices/+/events', { qos: 1 });
  adminClient.subscribe('devices/+/lwt', { qos: 1 }); // Last Will Testament
  
  // Request snapshot (backend publishes this)
  adminClient.publish('admin/request/snapshot', '', { qos: 0 });
});
```

**Step 3:** Handle incoming messages
```javascript
adminClient.on('message', (topic, payload) => {
  const data = JSON.parse(payload.toString());
  
  if (topic === 'devices/discovery/announce') {
    // New device discovered
    addDevice(data.deviceId, data);
  } else if (topic.endsWith('/status')) {
    // Device status update
    updateDeviceStatus(data.deviceId, data);
  } else if (topic.endsWith('/heartbeat')) {
    // Device heartbeat (mark as online)
    markDeviceOnline(data.deviceId);
  } else if (topic.endsWith('/lwt')) {
    // Device went offline (Last Will)
    markDeviceOffline(data.deviceId);
  }
});
```

---

### 3. **Backend Service** (Optional - for DB sync)

The backend can still run as a service to:
- Listen to MQTT topics
- Update database (`lastSeenAt`, etc.)
- Publish aggregated snapshots

**No Socket.IO needed!**

```javascript
// Backend MQTT client
const backendClient = mqtt.connect('mqtt://localhost:1883');

backendClient.on('connect', () => {
  backendClient.subscribe('devices/+/status');
  backendClient.subscribe('devices/+/heartbeat');
  
  // Publish device snapshot every 5 seconds (for new admins)
  setInterval(async () => {
    const devices = await getOnlineDevicesFromDB();
    backendClient.publish('admin/devices/snapshot', JSON.stringify(devices), { qos: 1, retain: true });
  }, 5000);
});

backendClient.on('message', (topic, payload) => {
  if (topic.includes('/status')) {
    const data = JSON.parse(payload.toString());
    updateDeviceInDB(data.deviceId, { lastSeenAt: new Date() });
  }
});
```

---

## Offline Detection

### Using Last Will Testament (LWT)

When a device connects, it sets a **Last Will** message:
```javascript
will: {
  topic: 'devices/VR_12345/lwt',
  payload: JSON.stringify({ deviceId: 'VR_12345', status: 'offline' }),
  qos: 1,
  retain: true
}
```

**When the device disconnects** (crash, network loss, etc.), the broker **automatically publishes** this message.

Admin panel subscribes to `devices/+/lwt` and marks the device offline immediately.

---

## Session Management

### Joining a Session

**Device publishes:**
```javascript
client.publish('devices/VR_12345/status', JSON.stringify({
  deviceId: 'VR_12345',
  sessionId: 'S_123',
  status: 'idle',
  timestamp: new Date().toISOString()
}), { qos: 1, retain: true });

// Subscribe to session commands
client.subscribe('sessions/S_123/commands/+', { qos: 1 });
```

**Admin sends commands:**
```javascript
adminClient.publish('sessions/S_123/commands/play', JSON.stringify({
  positionMs: 0,
  timestamp: new Date().toISOString()
}), { qos: 1 });
```

---

## Benefits of Pure MQTT

✅ **No backend dependency** - Devices and admin talk directly via broker  
✅ **True pub/sub** - Decoupled, scalable architecture  
✅ **Retained messages** - New admins get latest device status instantly  
✅ **QoS guarantees** - Reliable message delivery  
✅ **Last Will Testament** - Automatic offline detection  
✅ **Standard protocol** - Works with any MQTT client/library  

---

## Implementation Checklist

- [ ] Configure MQTT broker with WebSocket support (port 9001)
- [ ] Update React admin to use MQTT.js instead of Socket.IO
- [ ] Update Unity to use native MQTT client 
- [ ] Update HTML simulators to use MQTT.js
- [ ] Remove Socket.IO dependencies from backend
- [ ] Implement Last Will Testament for offline detection
- [ ] Test retained messages for status persistence
- [ ] Update DeviceDiscoveryService to use MQTT-only logic

---

## Next Steps

Would you like me to:
1. **Implement the React admin MQTT client** (replace Socket.IO)?
2. **Update the backend** to remove Socket.IO and use pure MQTT?
3. **Create Unity MQTT integration guide**?
4. **All of the above**?
