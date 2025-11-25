const express = require('express');
const DeviceController = require('../controllers/DeviceController');

const router = express.Router();
const controller = new DeviceController();

// Generate a 6-digit pairing code for 'vr' or 'chair'
router.post('/pairing-code', controller.generateCode);

// Generate a bundle code for pairing VR + Chair simultaneously
router.post('/pairing-bundle', controller.generateBundleCode);
// Poll bundle pairing status
router.get('/pairing-bundle/:code', controller.getBundleStatus);

// Register device with { type, code | bundleCode, deviceId, metadata? }
router.post('/register', controller.register);

// List registered devices
router.get('/', controller.list);

// Device Discovery Routes
router.post('/discover', controller.discover);
router.get('/discovered', controller.getDiscovered);
router.post('/:deviceId/command', controller.sendCommand);

module.exports = router;
