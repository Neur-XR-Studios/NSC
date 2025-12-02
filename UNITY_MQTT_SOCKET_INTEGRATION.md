# Unity MQTT & Socket.IO Integration Guide

**Source Reference**: `mqtt-vr-device.html`
**Purpose**: Integration details for connecting a Unity VR/Chair device to the NSC Backend.

## 1. Connection Details

*   **Protocol**: Socket.IO (v4)
*   **Transports**: `websocket` (Force WebSocket, do not use polling)
*   **Base URL**: `http://<BACKEND_IP>:8001` (e.g., `http://192.168.0.192:8001`)

---

## 2. Socket.IO Events (Device -> Backend)

These events are emitted directly via the Socket.IO client.

### A. Identification (Immediate upon connect)
**Event Name**: `device:identify`
**Payload**:
```json
{
  "deviceId": "VR_12345",
  "type": "vr",       // or "chair"
  "name": "My VR Device"
}
```

### B. Status Update
**Event Name**: `device:status`
**Payload**:
```json
{
  "deviceId": "VR_12345",
  "type": "vr",
  "status": "active", // "active" if playing, "idle" if not
  "positionMs": 15000,
  "sessionId": "S_ABC12", // Empty string "" if not in session
  "timestamp": "2023-10-27T10:00:00.000Z"
}
```

### C. Heartbeat (Every 15 seconds)
**Event Name**: `device:heartbeat`
**Payload**:
```json
{
  "deviceId": "VR_12345",
  "type": "vr",
  "status": "active",
  "timestamp": "2023-10-27T10:00:00.000Z"
}
```

### D. MQTT Bridge - Subscribe
**Event Name**: `mqtt_subscribe`
**Payload**:
```json
{
  "topic": "devices/VR_12345/commands/+",
  "options": { "qos": 1 }
}
```

### E. MQTT Bridge - Publish
**Event Name**: `mqtt_publish`
**Payload**:
```json
{
  "topic": "devices/discovery/announce",
  "payload": "{\"json_string_here\": \"...\"}", // Payload MUST be a JSON string
  "options": { "qos": 1, "retain": false }
}
```

---

## 3. MQTT Topics (Via Bridge)

You interact with these topics using the `mqtt_subscribe` and `mqtt_publish` Socket.IO events described above.

### A. Publishing (Device -> Backend)

| Purpose | Topic | Payload (JSON) | Retain |
| :--- | :--- | :--- | :--- |
| **Discovery** | `devices/discovery/announce` | `{ "deviceId": "...", "type": "vr", "name": "...", "metadata": {}, "timestamp": "..." }` | `false` |
| **Status** | `devices/{id}/status` | Same as `device:status` payload | `true` |
| **Heartbeat** | `devices/{id}/heartbeat` | Same as `device:heartbeat` payload | `false` |
| **Events** | `devices/{id}/events` | `{ "deviceId": "...", "event": "play", "positionMs": 0, "timestamp": "..." }` | `false` |

### B. Subscribing (Backend -> Device)

| Purpose | Topic |
| :--- | :--- |
| **Device Commands** | `devices/{deviceId}/commands/+` |
| **Session Commands** | `sessions/{sessionId}/commands/+` |
| **Discovery Scan** | `devices/discovery/scan` |

---

## 4. Incoming Commands (Handled via `mqtt_message` event)

**Event Name**: `mqtt_message`
**Data Structure**:
```json
{
  "topic": "devices/VR_12345/commands/play",
  "payload": { ... } // Can be an object or a JSON string
}
```

### Common Commands
*   **Play**: `.../commands/play`
*   **Pause**: `.../commands/pause`
*   **Stop**: `.../commands/stop`
*   **Seek**: `.../commands/seek` -> Payload: `{ "positionMs": 5000 }`
*   **Load Journey**: `.../commands/load_journey` -> Payload: `{ "journeyId": "123" }`
