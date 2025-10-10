const express = require('express');
const JourneyController = require('../controllers/JourneyController');
const JourneyValidator = require('../validator/JourneyValidator');
const auth = require('../middlewares/auth');

const router = express.Router();

const controller = new JourneyController();
const validator = new JourneyValidator();

// Create Journey by linking IDs only (video_id required)
router.post('/', auth(['admin']), validator.createValidator, controller.create);

// List Journeys
router.get('/', auth(['admin']), controller.list);

// VR-friendly list (simplified payload) - consider leaving public
router.get('/vr/list', controller.listForVr);

// Get Journey by ID
router.get('/:id', auth(['admin']), controller.get);

// Update Journey (link/unlink IDs only)
router.patch('/:id', auth(['admin']), validator.updateValidator, controller.update);

// Delete Journey (unlink mappings, keep media)
router.delete('/:id', auth(['admin']), controller.remove);

module.exports = router;
