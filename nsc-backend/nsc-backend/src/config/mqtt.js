const Joi = require('joi');
const configBase = require('./config');

// Validate and map MQTT-related env vars
const schema = Joi.object({
  MQTT_URL: Joi.string().uri({ scheme: ['mqtt', 'mqtts', 'ws', 'wss'] }).required(),
  MQTT_CLIENT_ID_PREFIX: Joi.string().default('nsc-backend'),
  MQTT_USERNAME: Joi.string().allow('', null),
  MQTT_PASSWORD: Joi.string().allow('', null),
  MQTT_KEEPALIVE: Joi.number().integer().min(10).default(60),
  MQTT_RECONNECT_MS: Joi.number().integer().min(0).default(2000),
  MQTT_PROTOCOL_VERSION: Joi.number().valid(4, 5).default(5),
  MQTT_CLEAN: Joi.boolean().default(true),
  MQTT_WS_PATH: Joi.string().allow('', null),
}).unknown();

const { value: env, error } = schema.validate(process.env, {
  abortEarly: false,
  stripUnknown: false,
});

if (error) {
  throw new Error(`MQTT config validation error: ${error.message}`);
}

const mqttConfig = {
  url: env.MQTT_URL,
  options: {
    clientId: `${env.MQTT_CLIENT_ID_PREFIX}_${Math.random().toString(16).slice(2, 10)}`,
    username: env.MQTT_USERNAME || undefined,
    password: env.MQTT_PASSWORD || undefined,
    keepalive: env.MQTT_KEEPALIVE,
    reconnectPeriod: env.MQTT_RECONNECT_MS,
    protocolVersion: env.MQTT_PROTOCOL_VERSION,
    clean: env.MQTT_CLEAN,
    // If using WebSocket with a path like /mqtt, set 'path' to that value
    path: env.MQTT_WS_PATH || undefined,
  },
};

module.exports = mqttConfig;
