const Redis = require('redis');
const { redis } = require('./config');

// If no Redis host is configured, export a no-op client
if (!redis.host) {
    module.exports = null;
} else {
    const url = `redis://${redis.host}:${redis.port}`;
    const client = Redis.createClient({ url });
    if ((redis.usePassword || '').toString().toUpperCase() === 'YES' && redis.password) {
        // For redis@4, authenticate via URL or socket options; auth() is deprecated.
        // Recreate client with password in URL if needed
        client.on('error', (err) => console.error('Redis error', err));
    }
    console.log('Redis Client loaded!!!');
    module.exports = client;
}
