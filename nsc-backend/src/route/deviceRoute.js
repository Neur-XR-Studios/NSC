const express = require('express');
const DeviceController = require('../controllers/DeviceController');

const router = express.Router();
const controller = new DeviceController();

// Generate a 6-digit pairing code for 'vr' or 'chair'
router.post('/pairing-code', controller.generateCode);

// Register device with { type, code, deviceId, metadata? } (device id will be assigned like VR_#001 / CHAIR_#001)
router.post('/register', controller.register);

// List registered devices
router.get('/', controller.list);

// Device Discovery Routes
router.post('/discover', controller.discover);
router.get('/discovered', controller.getDiscovered);
router.post('/:deviceId/command', controller.sendCommand);

module.exports = router;
