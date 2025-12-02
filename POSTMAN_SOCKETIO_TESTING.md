# Testing NSC Device Flow with Postman

Since the NSC system uses **Socket.IO**, you cannot use standard HTTP requests. You must use Postman's **Socket.IO** testing feature (available in Postman v10+).

## 1. Setup Connection
1.  Open Postman.
2.  Click **New** -> **Socket.IO**.
3.  Enter the URL: `http://localhost:8001` (or your backend IP).
4.  Click **Connect**.
    *   *You should see "Connected" in green.*

---

## 2. Simulate "Device Connection"
Once connected, you need to identify and announce the device.

### A. Identify (Register Socket)
1.  In the **Message** tab, enter Event Name: `device:identify`
2.  Select **JSON** as the format.
3.  Payload:
    ```json
    {
      "deviceId": "POSTMAN_TEST_01",
      "type": "chair",
      "name": "Postman Simulator"
    }
    ```
4.  Click **Send**.

### B. Announce (Discovery)
1.  Event Name: `mqtt_publish`
2.  Payload:
    ```json
    {
      "topic": "devices/discovery/announce",
      "payload": "{\"deviceId\": \"POSTMAN_TEST_01\", \"type\": \"chair\", \"name\": \"Postman Simulator\", \"metadata\": {}, \"timestamp\": \"2023-12-01T12:00:00Z\"}",
      "options": { "qos": 1 }
    }
    ```
    *Note: The inner `payload` MUST be a stringified JSON.*
3.  Click **Send**.

### C. Initial Status
1.  Event Name: `device:status`
2.  Payload:
    ```json
    {
      "deviceId": "POSTMAN_TEST_01",
      "type": "chair",
      "status": "idle",
      "positionMs": 0,
      "sessionId": "",
      "timestamp": "2023-12-01T12:00:00Z"
    }
    ```
3.  Click **Send**.

---

## 3. Simulate "Join Session"
To join a session (e.g., `S_12345`), you subscribe to its topic and update your status.

### A. Subscribe to Session Commands
1.  Event Name: `mqtt_subscribe`
2.  Payload:
    ```json
    {
      "topic": "sessions/S_12345/commands/+",
      "options": { "qos": 1 }
    }
    ```
3.  Click **Send**.

### B. Update Status (Link to Session)
1.  Event Name: `device:status`
2.  Payload:
    ```json
    {
      "deviceId": "POSTMAN_TEST_01",
      "type": "chair",
      "status": "idle",
      "positionMs": 0,
      "sessionId": "S_12345",
      "timestamp": "2023-12-01T12:05:00Z"
    }
    ```
3.  Click **Send**.

---

## 4. Simulate "Active State" (Heartbeat)
You must send this manually every ~15 seconds to stay "Online".

1.  Event Name: `device:heartbeat`
2.  Payload:
    ```json
    {
      "deviceId": "POSTMAN_TEST_01",
      "type": "chair",
      "status": "idle",
      "timestamp": "2023-12-01T12:05:15Z"
    }
    ```
3.  Click **Send**.

---

## 5. Simulate "Disconnect"
1.  Simply click the **Disconnect** button in Postman.
2.  The backend will detect the socket closure and mark `POSTMAN_TEST_01` as offline.
