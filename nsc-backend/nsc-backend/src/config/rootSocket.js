const mqttService = require('../service/MqttService');
const deviceDiscoveryService = require('../service/DeviceDiscoveryService');

// Map socket.id -> Set<deviceId>
const socketDevices = new Map();
// Map deviceId -> Set<socket.id>
const deviceSockets = new Map();

const rootSocket = (io) => {
    io.on('connection', (socket) => {
        console.log('New connection');
        // Send current device snapshot immediately so admin sees online devices after refresh/reconnect
        try {
            const devices = deviceDiscoveryService.getDiscoveredDevices();
            socket.emit('devices:snapshot', devices);
        } catch (e) {
            console.error('Error emitting devices snapshot on connect', e);
        }

        socket.on('join-room', (room) => {
            console.log('join room for', room);
            socket.join(room);
        });

        // Optional fallback: accept heartbeats over Socket.IO to refresh presence
        socket.on('device:heartbeat', (data = {}) => {
            try {
                const deviceId = data.deviceId;
                if (!deviceId) return;
                const payload = Buffer.from(JSON.stringify(data));
                deviceDiscoveryService.handleHeartbeat(`devices/${deviceId}/heartbeat`, payload);
            } catch (e) {
                console.error('Error handling device:heartbeat', e);
            }
        });

        // Optional fallback: accept status over Socket.IO as well
        socket.on('device:status', (data = {}) => {
            try {
                const deviceId = data.deviceId;
                if (!deviceId) return;
                const payload = Buffer.from(JSON.stringify(data));
                deviceDiscoveryService.handleStatusUpdate(`devices/${deviceId}/status`, payload);
            } catch (e) {
                console.error('Error handling device:status', e);
            }
        });

        // Allow HTML test files to publish MQTT messages for testing
        socket.on('mqtt_publish', (data) => {
            try {
                const { topic, payload, options = { qos: 0, retain: false } } = data;
                if (topic && payload) {
                    mqttService.publish(topic, payload, options);
                    console.log(`MQTT message published via Socket.IO: ${topic}`);
                    // Also mirror to in-process handlers to keep presence consistent even if MQTT path is delayed
                    try {
                        if (typeof payload === 'string') {
                            const buf = Buffer.from(payload);
                            if (topic === 'devices/discovery/announce') {
                                deviceDiscoveryService.handleDeviceAnnouncement(topic, buf);
                            } else if (/^devices\/[^/]+\/heartbeat$/.test(topic)) {
                                deviceDiscoveryService.handleHeartbeat(topic, buf);
                            } else if (/^devices\/[^/]+\/status$/.test(topic)) {
                                deviceDiscoveryService.handleStatusUpdate(topic, buf);
                            }
                        }
                    } catch (e) {
                        console.error('Error mirroring mqtt_publish to discovery handlers', e);
                    }
                }
            } catch (error) {
                console.error('Error publishing MQTT message via Socket.IO:', error);
            }
        });

        // Minimal subscribe-forward bridge for tests: emit to all sockets
        socket.on('mqtt_subscribe', (data) => {
            try {
                const { topic, options = { qos: 0 } } = data || {};
                if (!topic) return;
                // Subscribe once per topic; handler will broadcast to all
                mqttService.subscribe(topic, (msgTopic, payload) => {
                    let parsed;
                    try {
                        parsed = JSON.parse(payload?.toString?.() ?? '');
                    } catch (e) {
                        parsed = payload?.toString?.();
                    }
                    io.emit('mqtt_message', { topic: msgTopic, payload: parsed });
                }, options);
                console.log(`MQTT subscribed via Socket.IO: ${topic}`);
            } catch (error) {
                console.error('Error subscribing MQTT via Socket.IO:', error);
            }
        });

        socket.on('mqtt_unsubscribe', (data) => {
            try {
                const { topic } = data || {};
                if (!topic) return;
                // No-op: keep backend subscriptions active for all clients.
                // Individual sockets can ignore messages client-side.
                console.log(`MQTT unsubscribe (ignored) via Socket.IO: ${topic}`);
            } catch (error) {
                console.error('Error handling MQTT unsubscribe via Socket.IO:', error);
            }
        });

        // Allow clients to fetch device list on demand
        socket.on('devices:get', () => {
            try {
                const devices = deviceDiscoveryService.getDiscoveredDevices();
                socket.emit('devices:snapshot', devices);
            } catch (e) {
                console.error('Error handling devices:get', e);
            }
        });

        // Devices identify themselves so we can mark immediate offline on disconnect
        socket.on('device:identify', (data = {}) => {
            try {
                const deviceId = data.deviceId;
                if (!deviceId) return;
                let set = socketDevices.get(socket.id);
                if (!set) { set = new Set(); socketDevices.set(socket.id, set); }
                set.add(deviceId);
                // track reverse mapping
                let sockSet = deviceSockets.get(deviceId);
                if (!sockSet) { sockSet = new Set(); deviceSockets.set(deviceId, sockSet); }
                sockSet.add(socket.id);
                // Optionally upsert minimal discovery info
                const existing = deviceDiscoveryService.getDiscoveredDevice(deviceId);
                if (!existing) {
                    // Create a lightweight entry by simulating a discovery
                    deviceDiscoveryService.discoveredDevices.set(deviceId, {
                        deviceId,
                        type: (data.type === 'vr' || data.type === 'chair') ? data.type : 'unknown',
                        name: data.name || 'Device',
                        metadata: {},
                        lastSeen: new Date(),
                        discoveredAt: new Date(),
                        isRegistered: false,
                    });
                    deviceDiscoveryService.setupHeartbeatMonitoring(deviceId);
                    io.emit('device:discovered', {
                        deviceId,
                        type: deviceDiscoveryService.discoveredDevices.get(deviceId).type,
                        name: deviceDiscoveryService.discoveredDevices.get(deviceId).name,
                        metadata: {},
                        isRegistered: false,
                        lastSeen: new Date(),
                    });
                }
            } catch (e) {
                console.error('Error handling device:identify', e);
            }
        });

        socket.on('disconnect', () => {
            console.log('disconnected');
            // Immediate offline for identified devices on this socket
            const devs = socketDevices.get(socket.id);
            if (devs && devs.size) {
                for (const deviceId of devs.values()) {
                    try {
                        // remove this socket from reverse mapping
                        const sockSet = deviceSockets.get(deviceId);
                        if (sockSet) {
                            sockSet.delete(socket.id);
                            if (sockSet.size === 0) {
                                deviceSockets.delete(deviceId);
                                // only mark offline if no other sockets are connected for this device
                                deviceDiscoveryService.handleDeviceTimeout(deviceId);
                            }
                        } else {
                            // no tracking, fallback to timeout
                            deviceDiscoveryService.handleDeviceTimeout(deviceId);
                        }
                    } catch (e) {
                        console.error('Error marking device offline on disconnect', deviceId, e);
                    }
                }
            }
            socketDevices.delete(socket.id);
        });
    });
    return io;
};
module.exports = rootSocket;
