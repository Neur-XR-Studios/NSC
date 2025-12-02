# Postman to React Verification Guide

This guide explains how to use Postman to simulate a device and verify the results in the React Frontend (Admin/Operator Panel).

**Prerequisites:**
1.  **Backend Running**: Ensure your Node.js backend is running (`npm start`).
2.  **Frontend Running**: Ensure your React app is running (`npm run dev`) and open in Chrome.
3.  **Postman Connected**: Connect Postman to `http://localhost:8001` via Socket.IO (see `POSTMAN_SOCKETIO_TESTING.md`).

---

## 1. Device Discovery
**Goal**: Make the device appear in the React Device List.

| Step | Action in Postman | Result in React (Frontend) |
| :--- | :--- | :--- |
| **1** | Send `device:identify` event.<br>`{ "deviceId": "POSTMAN_01", "type": "chair" }` | **Admin Panel > Devices**: A new row appears for `POSTMAN_01`.<br>**Operator Panel**: Device appears in the "Available Devices" list. |
| **2** | Send `mqtt_publish` (Announce).<br>*(See Testing Guide for payload)* | **Status Badge**: Shows "Online" (Green dot). |

---

## 2. Status Updates
**Goal**: Change the device status (Idle vs Active) in React.

| Step | Action in Postman | Result in React (Frontend) |
| :--- | :--- | :--- |
| **1** | Send `device:status` with `"status": "active"`. | **Device Card**: Status badge changes to **"Active"** (often Blue or Green).<br>**Icons**: VR/Chair icon might animate or highlight. |
| **2** | Send `device:status` with `"status": "idle"`. | **Device Card**: Status badge changes to **"Idle"** (Grey or Yellow). |

---

## 3. Session Joining
**Goal**: Show the device as "Assigned" to a session.

| Step | Action in Postman | Result in React (Frontend) |
| :--- | :--- | :--- |
| **1** | Send `device:status` with `"sessionId": "S_123"`. | **Session View**: The device appears under "Connected Devices" for Session `S_123`.<br>**Operator Panel**: Device shows as "Joined S_123". |

---

## 4. Heartbeat (Keep Alive)
**Goal**: Prevent the device from going Offline.

| Step | Action in Postman | Result in React (Frontend) |
| :--- | :--- | :--- |
| **1** | Send `device:heartbeat` every 15s. | **Last Seen**: The "Last Seen" timestamp updates.<br>**Status**: Remains "Online". |
| **2** | **Stop** sending heartbeat for >45s. | **Status**: Automatically changes to **"Offline"** (Red) in React. |

---

## 5. Disconnection
**Goal**: Immediately show device as Offline.

| Step | Action in Postman | Result in React (Frontend) |
| :--- | :--- | :--- |
| **1** | Click **Disconnect** in Postman. | **Status**: Immediately changes to **"Offline"** (Red) in React. |
