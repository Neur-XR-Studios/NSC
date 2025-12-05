const express = require('express');
const SessionController = require('../controllers/SessionController');
const auth = require('../middlewares/auth');

const router = express.Router();
const controller = new SessionController();

// Retrieve sessions with optional status filter (default on_going)
// Auth required to filter sessions by operator_id for isolation
router.get('/', auth(['admin', 'user']), controller.list);

// Retrieve a single session by ID
router.get('/:id', auth(['admin', 'user']), controller.getById);

// Create a session by mapping VR + chair - admin only
router.post('/', auth(['admin', 'user']), controller.start);

// Create session from device pair - admin only
router.post('/from-pair', auth(['admin', 'user']), controller.startFromPair);

// Create a group session (auto-generate groupId if not provided) - admin only
router.post('/group', auth(['admin', 'user']), controller.createGroup);

// Create group session from device pairs - admin only
router.post('/group/from-pairs', auth(['admin', 'user']), controller.createGroupFromPairs);

// Send a command to a session (start/pause/seek/stop) - admin only
router.post('/:id/commands', auth(['admin', 'user']), controller.command);
// Backward-compatible alias
router.post('/:id/command', auth(['admin', 'user']), controller.command);

// Participants (Individual flow) - admin only
router.post('/:id/participants', auth(['admin', 'user']), controller.addParticipant);
router.delete('/:id/participants/:pid', auth(['admin', 'user']), controller.removeParticipant);
router.post('/:id/participants/:pid/commands', auth(['admin', 'user']), controller.commandParticipant);

// Update session metadata (type, journey, participants, etc.) - admin only
router.patch('/:id', auth(['admin', 'user']), controller.update);

// Update only overall status - admin only
router.patch('/:id/status', auth(['admin', 'user']), controller.updateStatus);

// Delete a session and its participants - admin only
router.delete('/:id', auth(['admin', 'user']), controller.remove);

// Get active sessions (for session persistence) - admin only
router.get('/active/list', auth(['admin', 'user']), controller.getActiveSessions);

// Get devices currently in active sessions (for showing "in session" status to other operators)
router.get('/devices/in-session', auth(['admin', 'user']), controller.getDevicesInSession);

// Unpair/deactivate a session - admin only
router.delete('/:id/unpair', auth(['admin', 'user']), controller.unpairSession);

// ============ DEVICE-FACING ENDPOINTS (No Auth Required) ============
// These endpoints are for VR/Chair devices that don't have user authentication
// They provide the same data but without operator isolation filtering

// List sessions for devices - no auth required
router.get('/device/list', controller.listForDevice);

// Get session by ID for devices - no auth required
router.get('/device/:id', controller.getByIdForDevice);

module.exports = router;
