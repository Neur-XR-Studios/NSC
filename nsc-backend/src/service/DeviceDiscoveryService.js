const mqttService = require('./MqttService');
const { VRDevice, ChairDevice } = require('../models');
const logger = require('../config/logger');

class DeviceDiscoveryService {
  constructor() {
    this.discoveredDevices = new Map(); // deviceId -> device info
    this.heartbeatTimers = new Map(); // deviceId -> timer
    this.HEARTBEAT_TIMEOUT = 45000; // 45 seconds for tolerance; socket disconnect still triggers immediate offline
    this.setupMqttHandlers();
  }

  setupMqttHandlers() {
    // Listen for device announcements
    mqttService.subscribe('devices/discovery/announce', this.handleDeviceAnnouncement.bind(this));

    // Listen for heartbeats from all devices
    mqttService.subscribe('devices/+/heartbeat', this.handleHeartbeat.bind(this));

    // Listen for device status updates
    mqttService.subscribe('devices/+/status', this.handleStatusUpdate.bind(this));

    // Listen for Last Will Testament (offline detection)
    mqttService.subscribe('devices/+/lwt', this.handleLastWill.bind(this));

    // Listen for admin snapshot requests
    mqttService.subscribe('admin/devices/request_snapshot', this.handleSnapshotRequest.bind(this));

    logger.info('[DeviceDiscovery] MQTT handlers setup complete');
  }

  /**
   * Handle admin request for device snapshot
   */
  handleSnapshotRequest(topic, payload) {
    try {
      logger.info('[DeviceDiscovery] Snapshot requested by admin');
      this.publishDeviceSnapshot();
    } catch (error) {
      logger.error('[DeviceDiscovery] Error handling snapshot request', { error: error.message });
    }
  }

  /**
   * Handle device announcement messages
   * Expected payload: { deviceId, type, name?, metadata?, timestamp }
   */
  async handleDeviceAnnouncement(topic, payload) {
    try {
      const data = JSON.parse(payload.toString());
      const { deviceId, type, name, metadata, timestamp } = data;

      if (!deviceId || !type || !['vr', 'chair'].includes(type)) {
        logger.warn('[DeviceDiscovery] Invalid announcement', { data });
        return;
      }

      // Store discovered device info
      this.discoveredDevices.set(deviceId, {
        deviceId,
        type,
        name: name || `${type.toUpperCase()} Device`,
        metadata: metadata || {},
        lastSeen: new Date(),
        discoveredAt: timestamp ? new Date(timestamp) : new Date(),
        isRegistered: false,
        online: true
      });

      // Check if device is already registered
      const Model = type === 'vr' ? VRDevice : ChairDevice;
      const existingDevice = await Model.findOne({ where: { deviceId } });

      if (existingDevice) {
        // Update last seen time for registered devices
        await existingDevice.update({ lastSeenAt: new Date() });
        this.discoveredDevices.get(deviceId).isRegistered = true;
        logger.info('[DeviceDiscovery] Registered device announced', { deviceId, type });
      } else {
        logger.info('[DeviceDiscovery] New device discovered', { deviceId, type });
      }

      // Setup heartbeat monitoring
      this.setupHeartbeatMonitoring(deviceId);

      // Publish device snapshot for admin clients
      this.publishDeviceSnapshot();

    } catch (error) {
      logger.error('[DeviceDiscovery] Error handling announcement', { error: error.message });
    }
  }

  /**
   * Handle heartbeat messages from devices
   */
  async handleHeartbeat(topic, payload) {
    try {
      const deviceId = topic.split('/')[1]; // Extract deviceId from topic
      const data = JSON.parse(payload.toString());

      let device = this.discoveredDevices.get(deviceId);
      if (!device) {
        // Create a placeholder entry when heartbeat arrives before announcement
        device = {
          deviceId,
          type: data?.type && ['vr', 'chair'].includes(data.type) ? data.type : 'unknown',
          name: 'Device',
          metadata: {},
          lastSeen: new Date(),
          discoveredAt: new Date(),
          isRegistered: false,
        };
        this.discoveredDevices.set(deviceId, device);
        // Start heartbeat monitoring for new device
        this.setupHeartbeatMonitoring(deviceId);
        // Publish snapshot for admin clients
        this.publishDeviceSnapshot();
      } else {
        device.lastSeen = new Date();
        device.online = true;
      }

      // Update database for all devices (not just registered ones)
      // This ensures lastSeenAt is always current for online status tracking
      if (device.type === 'vr' || device.type === 'chair') {
        const Model = device.type === 'vr' ? VRDevice : ChairDevice;
        try {
          await Model.update(
            { lastSeenAt: new Date() },
            { where: { deviceId } }
          );
        } catch (dbErr) {
          // Device might not exist in DB yet, that's OK
        }
      }

      // Reset heartbeat timer
      this.setupHeartbeatMonitoring(deviceId);
    } catch (error) {
      logger.error('[DeviceDiscovery] Error handling heartbeat', { error: error.message });
    }
  }

  /**
   * Handle device status updates
   */
  async handleStatusUpdate(topic, payload) {
    try {
      const deviceId = topic.split('/')[1];
      const statusData = JSON.parse(payload.toString());

      logger.info('[DeviceDiscovery] Status update', { deviceId, status: statusData });

      // Upsert device record if not present
      let device = this.discoveredDevices.get(deviceId);
      let isNew = false;
      if (!device) {
        device = {
          deviceId,
          type: (statusData?.type && ['vr', 'chair'].includes(statusData.type)) ? statusData.type : 'unknown',
          name: statusData?.name || 'Device',
          metadata: {},
          lastSeen: new Date(),
          discoveredAt: new Date(),
          isRegistered: false,
        };
        this.discoveredDevices.set(deviceId, device);
        isNew = true;
        // Start heartbeat monitoring for new devices
        this.setupHeartbeatMonitoring(deviceId);
      } else {
        device.lastSeen = new Date();
      }

      // Refresh heartbeat timeout on any status update
      this.setupHeartbeatMonitoring(deviceId);

      // Publish snapshot for admin clients
      this.publishDeviceSnapshot();
    } catch (error) {
      logger.error('[DeviceDiscovery] Error handling status update', { error: error.message });
    }
  }

  /**
   * Setup heartbeat monitoring for a device
   */
  setupHeartbeatMonitoring(deviceId) {
    // Clear existing timer
    if (this.heartbeatTimers.has(deviceId)) {
      clearTimeout(this.heartbeatTimers.get(deviceId));
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.handleDeviceTimeout(deviceId);
    }, this.HEARTBEAT_TIMEOUT);

    this.heartbeatTimers.set(deviceId, timer);
  }

  /**
   * Handle device timeout (no heartbeat received)
   */
  handleDeviceTimeout(deviceId) {
    const device = this.discoveredDevices.get(deviceId);
    if (device) {
      logger.warn('[DeviceDiscovery] Device timeout', { deviceId, type: device.type });

      // Mark as offline but keep in memory so it doesn't disappear from admin
      device.online = false;

      // Publish snapshot to notify admin clients
      this.publishDeviceSnapshot();
    }

    // Clean up timer
    this.heartbeatTimers.delete(deviceId);
  }

  /**
   * Request devices to announce themselves
   */
  requestDeviceScan() {
    const scanRequest = {
      timestamp: new Date().toISOString(),
      requestId: Math.random().toString(36).substr(2, 9)
    };

    mqttService.publish('devices/discovery/scan', JSON.stringify(scanRequest), { qos: 1 });
    logger.info('[DeviceDiscovery] Device scan requested', { requestId: scanRequest.requestId });

    return scanRequest.requestId;
  }

  /**
   * Get list of currently discovered devices
   */
  getDiscoveredDevices() {
    return Array.from(this.discoveredDevices.values());
  }

  /**
   * Get discovered device by ID
   */
  getDiscoveredDevice(deviceId) {
    return this.discoveredDevices.get(deviceId);
  }

  /**
   * Send command to specific device
   */
  sendDeviceCommand(deviceId, command, payload = {}) {
    const topic = `devices/${deviceId}/commands/${command}`;
    const message = {
      command,
      payload,
      timestamp: new Date().toISOString(),
      requestId: Math.random().toString(36).substr(2, 9)
    };

    mqttService.publish(topic, JSON.stringify(message), { qos: 1 });
    logger.info('[DeviceDiscovery] Command sent', { deviceId, command, requestId: message.requestId });

    return message.requestId;
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    // Clear all heartbeat timers
    for (const timer of this.heartbeatTimers.values()) {
      clearTimeout(timer);
    }
    this.heartbeatTimers.clear();
    this.discoveredDevices.clear();

    logger.info('[DeviceDiscovery] Cleanup completed');
  }

  /**
   * Handle Last Will Testament (device offline)
   */
  async handleLastWill(topic, payload) {
    try {
      const deviceId = topic.split('/')[1];
      const data = JSON.parse(payload.toString());

      logger.info('[DeviceDiscovery] Last Will received', { deviceId });

      const device = this.discoveredDevices.get(deviceId);
      if (device) {
        device.online = false;
        device.lastSeen = new Date();

        // Clear heartbeat timer
        if (this.heartbeatTimers.has(deviceId)) {
          clearTimeout(this.heartbeatTimers.get(deviceId));
          this.heartbeatTimers.delete(deviceId);
        }

        // Publish snapshot to notify admin clients
        this.publishDeviceSnapshot();
      }
    } catch (error) {
      logger.error('[DeviceDiscovery] Error handling Last Will', { error: error.message });
    }
  }

  /**
   * Publish device snapshot as retained message for admin clients
   */
  publishDeviceSnapshot() {
    try {
      const devices = Array.from(this.discoveredDevices.values()).map(d => ({
        deviceId: d.deviceId,
        type: d.type,
        name: d.name,
        metadata: d.metadata,
        online: d.online,
        lastSeen: d.lastSeen,
        isRegistered: d.isRegistered
      }));

      // Publish as retained message so new admin clients get it immediately
      mqttService.publish(
        'admin/devices/snapshot',
        JSON.stringify(devices),
        { qos: 1, retain: true }
      );
    } catch (error) {
      logger.error('[DeviceDiscovery] Error publishing snapshot', { error: error.message });
    }
  }
}

module.exports = new DeviceDiscoveryService();
