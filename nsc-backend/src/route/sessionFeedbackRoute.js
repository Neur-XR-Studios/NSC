const express = require('express');
const SessionFeedbackController = require('../controllers/SessionFeedbackController');
const SessionFeedbackValidator = require('../validator/SessionFeedbackValidator');
const auth = require('../middlewares/auth');

const router = express.Router();
const controller = new SessionFeedbackController();

// Create new feedback (public or authenticated depending on requirements)
router.post(
    '/',
    SessionFeedbackValidator.validate(SessionFeedbackValidator.createSchema),
    controller.create
);

// Get feedback by session ID
router.get(
    '/session/:sessionId',
    SessionFeedbackValidator.validate(SessionFeedbackValidator.sessionIdSchema),
    controller.getBySessionId
);

// List all feedbacks with pagination (admin only)
router.get(
    '/',
    auth(['admin']),
    SessionFeedbackValidator.validate(SessionFeedbackValidator.listSchema),
    controller.list
);

// Get feedback statistics (admin only)
router.get(
    '/stats/all',
    auth(['admin']),
    controller.getStats
);

module.exports = router;
