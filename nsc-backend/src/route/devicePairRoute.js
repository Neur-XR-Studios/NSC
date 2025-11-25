const express = require('express');
const DevicePairController = require('../controllers/DevicePairController');

const router = express.Router();
const controller = new DevicePairController();

// Get available (unpaired) devices - must be before /:id route
router.get('/available/devices', controller.getAvailableDevices);

// Get online pairs
router.get('/online', controller.getOnlinePairs);

// CRUD operations
router.post('/', controller.create);
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.patch('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
