const mqtt = require('mqtt');
const logger = require('../config/logger');
const mqttConfig = require('../config/mqtt');

// Simple MQTT topic matcher supporting '+' (single level) and '#' (multi level)
function topicMatches(pattern, topic) {
  if (pattern === topic) return true;
  const pLevels = pattern.split('/');
  const tLevels = topic.split('/');

  for (let i = 0, j = 0; i < pLevels.length; i += 1, j += 1) {
    const p = pLevels[i];
    const t = tLevels[j];

    if (p === '#') {
      // '#' must be last in pattern and matches remaining levels (including none)
      return i === pLevels.length - 1;
    }

    if (t === undefined) {
      // topic ended but pattern still has levels (and current isn't '#')
      return false;
    }

    if (p === '+') {
      // matches exactly one level -> continue
      continue;
    }

    if (p !== t) {
      return false;
    }
  }

  // If pattern consumed, topic must also be fully consumed
  return tLevels.length === pLevels.length || pLevels[pLevels.length - 1] === '#';
}

class MqttService {
  constructor() {
    this.client = null;
    this.connected = false;
    this.subscriptions = new Map(); // topic -> { handlers: Function[], options }
  }

  connect() {
    if (this.client) {
      return this.client;
    }

    logger.info('[MQTT] Connecting...', { url: mqttConfig.url });
    this.client = mqtt.connect(mqttConfig.url, mqttConfig.options);

    this.client.on('connect', (packet) => {
      this.connected = true;
      logger.info('[MQTT] Connected', { clientId: mqttConfig.options.clientId, sessionPresent: packet?.sessionPresent });
      // Re-subscribe after reconnect
      for (const [topic, entry] of this.subscriptions) {
        this.client.subscribe(topic, (entry?.options || {}), (err) => {
          if (err) logger.error('[MQTT] Resubscribe error', { topic, err });
        });
      }
    });

    this.client.on('reconnect', () => {
      logger.info('[MQTT] Reconnecting...');
    });

    this.client.on('close', () => {
      this.connected = false;
      logger.warn('[MQTT] Connection closed');
    });

    this.client.on('error', (err) => {
      logger.error('[MQTT] Error', { err: err?.message });
    });

    this.client.on('message', (topic, payload, packet) => {
      // Dispatch to all matching wildcard subscriptions with all handlers
      for (const [pattern, entry] of this.subscriptions.entries()) {
        if (!entry || !Array.isArray(entry.handlers) || entry.handlers.length === 0) continue;
        if (topicMatches(pattern, topic)) {
          for (const handler of entry.handlers) {
            try {
              handler(topic, payload, packet);
            } catch (err) {
              logger.error('[MQTT] Handler error', { topic, pattern, err: err?.message });
            }
          }
        }
      }
    });

    return this.client;
  }

  publish(topic, message, options = { qos: 0, retain: false }) {
    if (!this.client) this.connect();
    const payload = Buffer.isBuffer(message) ? message : Buffer.from(typeof message === 'string' ? message : JSON.stringify(message));
    this.client.publish(topic, payload, options, (err) => {
      if (err) {
        logger.error('[MQTT] Publish error', { topic, err: err?.message });
      }
    });
  }

  subscribe(topic, handler, options = { qos: 0 }) {
    if (!this.client) this.connect();
    // If already subscribed, just record another handler; otherwise do a real subscribe
    const existing = this.subscriptions.get(topic);
    if (existing) {
      existing.handlers.push(handler);
      logger.info('[MQTT] Added handler to existing subscription', { topic, handlers: existing.handlers.length });
      return;
    }

    this.client.subscribe(topic, options, (err) => {
      if (err) {
        logger.error('[MQTT] Subscribe error', { topic, err: err?.message });
      } else {
        this.subscriptions.set(topic, { handlers: [handler], options });
        logger.info('[MQTT] Subscribed', { topic });
      }
    });
  }

  unsubscribe(topic) {
    if (!this.client) return;
    this.client.unsubscribe(topic, (err) => {
      if (err) {
        logger.error('[MQTT] Unsubscribe error', { topic, err: err?.message });
      } else {
        this.subscriptions.delete(topic);
        logger.info('[MQTT] Unsubscribed', { topic });
      }
    });
  }

  end(force = false) {
    if (!this.client) return;
    this.client.end(force, () => {
      logger.info('[MQTT] Client ended');
      this.client = null;
      this.connected = false;
      this.subscriptions.clear();
    });
  }
}

module.exports = new MqttService();
