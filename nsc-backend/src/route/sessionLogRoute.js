const express = require('express');
const SessionLogController = require('../controllers/SessionLogController');
const SessionLogValidator = require('../validator/SessionLogValidator');

const router = express.Router();
const controller = new SessionLogController();
const validator = new SessionLogValidator();

// Create a session log entry
router.post('/', validator.createValidator, controller.create);

// List logs with optional filters: session_id, journey_id, event
router.get('/', controller.list);

// Get a single log
router.get('/:id', controller.get);

// Update a log
router.put('/:id', validator.updateValidator, controller.update);

// Delete a log
router.delete('/:id', controller.remove);

module.exports = router;
