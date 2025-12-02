const express = require('express');
const router = express.Router();
const mqttService = require('../service/MqttService');

// In-memory command queue for devices (simple polling mechanism)
const deviceCommands = new Map();

/**
 * POST /api/mqtt/publish
 * Publish a message to MQTT from Unity devices
 */
router.post('/publish', async (req, res) => {
    try {
        const { topic, payload, retain } = req.body;

        if (!topic) {
            return res.status(400).json({ error: 'Topic is required' });
        }

        // Use mqttService directly instead of app.get
        const mqttClient = mqttService.client;

        if (!mqttClient || !mqttClient.connected) {
            console.warn('[MQTT Route] MQTT not connected, attempting to use service...');

            // Try using mqttService.publish instead
            try {
                mqttService.publish(topic, payload || '', { retain: retain || false });
                console.log(`[MQTT Route] Published via service to ${topic}`);
                return res.json({ success: true, topic });
            } catch (pubErr) {
                console.error('[MQTT Route] Service publish error:', pubErr);
                return res.status(503).json({ error: 'MQTT broker not connected' });
            }
        }

        // Publish to MQTT
        const options = {
            qos: 1,
            retain: retain || false
        };

        mqttClient.publish(topic, payload || '', options, (err) => {
            if (err) {
                console.error('[MQTT Route] Publish error:', err);
                return res.status(500).json({ error: 'Failed to publish' });
            }

            console.log(`[MQTT Route] Published to ${topic}`);
            res.json({ success: true, topic });
        });

    } catch (error) {
        console.error('[MQTT Route] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/mqtt/commands/:deviceId
 * Get pending commands for a device (polling endpoint)
 */
router.get('/commands/:deviceId', (req, res) => {
    const { deviceId } = req.params;

    // Get and clear commands for this device
    const commands = deviceCommands.get(deviceId) || [];
    deviceCommands.set(deviceId, []);

    res.json(commands);
});

/**
 * POST /api/mqtt/commands/:deviceId
 * Queue a command for a device (called by admin panel)
 */
router.post('/commands/:deviceId', (req, res) => {
    const { deviceId } = req.params;
    const { command, payload } = req.body;

    if (!command) {
        return res.status(400).json({ error: 'Command is required' });
    }

    // Add to command queue
    if (!deviceCommands.has(deviceId)) {
        deviceCommands.set(deviceId, []);
    }

    deviceCommands.get(deviceId).push({
        command,
        payload: payload || '{}'
    });

    console.log(`[MQTT Route] Queued command ${command} for device ${deviceId}`);
    res.json({ success: true });
});

module.exports = router;
