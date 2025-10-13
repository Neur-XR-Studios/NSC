const express = require('express');
const SessionController = require('../controllers/SessionController');

const router = express.Router();
const controller = new SessionController();

// Retrieve sessions with optional status filter (default on_going)
router.get('/', controller.list);

// Retrieve a single session by ID
router.get('/:id', controller.getById);

// Create a session by mapping VR + chair
router.post('/', controller.start);

// Create a group session (auto-generate groupId if not provided)
router.post('/group', controller.createGroup);

// Send a command to a session (start/pause/seek/stop)
router.post('/:id/commands', controller.command);
// Backward-compatible alias
router.post('/:id/command', controller.command);

// Participants (Individual flow)
router.post('/:id/participants', controller.addParticipant);
router.delete('/:id/participants/:pid', controller.removeParticipant);
router.post('/:id/participants/:pid/commands', controller.commandParticipant);

// Update session metadata (type, journey, participants, etc.)
router.patch('/:id', controller.update);

// Update only overall status
router.patch('/:id/status', controller.updateStatus);

// Delete a session and its participants
router.delete('/:id', controller.remove);

module.exports = router;
