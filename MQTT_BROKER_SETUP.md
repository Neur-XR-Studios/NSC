# MQTT Broker WebSocket Configuration Guide

## Quick Setup (Mosquitto)

### 1. Install Mosquitto
```bash
# macOS
brew install mosquitto

# Ubuntu/Debian
sudo apt-get install mosquitto mosquitto-clients

# Windows
# Download from: https://mosquitto.org/download/
```

### 2. Create Configuration File

Create `/usr/local/etc/mosquitto/mosquitto.conf` (macOS) or `/etc/mosquitto/mosquitto.conf` (Linux):

```conf
# Standard MQTT (for Unity native clients)
listener 1883
protocol mqtt
allow_anonymous true

# WebSocket for browsers (React, HTML)
listener 9001
protocol websocket
allow_anonymous true

# Logging
log_dest stdout
log_type all

# Persistence
persistence true
persistence_location /usr/local/var/mosquitto/
```

### 3. Start Broker

```bash
# macOS (with Homebrew)
brew services start mosquitto

# Or run manually with config
mosquitto -c /usr/local/etc/mosquitto/mosquitto.conf

# Linux
sudo systemctl start mosquitto
sudo systemctl enable mosquitto

# Check status
mosquitto -h
```

### 4. Test Connection

**Test MQTT (port 1883):**
```bash
# Subscribe
mosquitto_sub -h localhost -t "test/topic" -v

# Publish (in another terminal)
mosquitto_pub -h localhost -t "test/topic" -m "Hello MQTT"
```

**Test WebSocket (port 9001):**
Open browser console and run:
```javascript
const client = mqtt.connect('ws://localhost:9001');
client.on('connect', () => console.log('Connected!'));
```

---

## Environment Variables

Update your `.env` files:

### Backend (`.env`)
```env
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_USERNAME=
MQTT_PASSWORD=
```

### Frontend (`.env`)
```env
VITE_MQTT_WS_URL=ws://localhost:9001
```

---

## Production Setup (Optional)

### Enable Authentication

1. Create password file:
```bash
mosquitto_passwd -c /etc/mosquitto/passwd admin
# Enter password when prompted
```

2. Update config:
```conf
allow_anonymous false
password_file /etc/mosquitto/passwd
```

### Enable TLS/SSL

```conf
listener 9002
protocol websocket
cafile /path/to/ca.crt
certfile /path/to/server.crt
keyfile /path/to/server.key
```

---

## Troubleshooting

### Port Already in Use
```bash
# Find process using port 9001
lsof -i :9001
# Kill process
kill -9 <PID>
```

### Permission Denied
```bash
# macOS
sudo chown -R $(whoami) /usr/local/var/mosquitto

# Linux
sudo chown -R mosquitto:mosquitto /var/lib/mosquitto
```

### Check Logs
```bash
# macOS
tail -f /usr/local/var/log/mosquitto/mosquitto.log

# Linux
sudo journalctl -u mosquitto -f
```

---

## Next Steps

After broker is running:
1. ✅ Backend will connect automatically on startup
2. ✅ React admin will connect when you open the panel
3. ✅ Devices (Unity/HTML) will connect when started

**Verify** by checking broker logs - you should see connections from all clients.
