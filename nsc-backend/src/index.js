const app = require('./app');
const config = require('./config/config');
const mqttService = require('./service/MqttService');
const deviceDiscoveryService = require('./service/DeviceDiscoveryService');

require('./cronJobs');
// eslint-disable-next-line import/order
const http = require('http');
// socket initialization
const server = http.createServer(app);
// eslint-disable-next-line import/order
const io = require('socket.io')(server, {
    cors: {
        origin: process.env.NODE_ENV === 'development' ? true : (process.env.CORS_ORIGIN || '*').split(','),
        methods: ['GET', 'POST'],
        credentials: true
    },
    allowEIO3: true
});

global.io = io;
require('./config/rootSocket')(io);

if (!process.env.BASE_URL) {
    const host = process.env.PUBLIC_HOST || 'localhost';
    const port = process.env.BACKEND_PORT || process.env.PORT || 5000;
    process.env.BASE_URL = `http://${host}:${port}`;
}

// Initialize MQTT connection
mqttService.connect();

// Expose MQTT client to app for use in routes
app.set('mqttClient', mqttService.client);

// Proactively request device announcements shortly after startup
setTimeout(() => {
    try {
        deviceDiscoveryService.requestDeviceScan();
    } catch (e) {
        // ignore scan errors
    }
}, 2000);

server.listen(config.port, () => {
    console.log('SERVER');
    console.log(`Listening to port ${config.port}`);
});

// Graceful shutdown
const shutdown = (signal) => {
    console.log(`\nReceived ${signal}. Shutting down gracefully...`);
    try {
        deviceDiscoveryService.cleanup();
        mqttService.end();
    } catch (e) {
        // ignore
    }
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
    // Force exit if not closed within 5s
    setTimeout(() => process.exit(1), 5000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
