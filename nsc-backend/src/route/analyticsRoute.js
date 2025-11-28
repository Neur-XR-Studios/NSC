const express = require('express');
const router = express.Router();
const AnalyticsController = require('../controllers/AnalyticsController');
const auth = require('../middlewares/auth');

/**
 * @route   GET /api/analytics/overview
 * @desc    Get comprehensive analytics overview
 * @access  Admin only
 */
router.get('/overview', auth(['admin']), AnalyticsController.getOverview);

/**
 * @route   GET /api/analytics/sessions
 * @desc    Get session count and trend metrics
 * @access  Admin only
 */
router.get('/sessions', auth(['admin']), AnalyticsController.getSessionMetrics);

/**
 * @route   GET /api/analytics/seats
 * @desc    Get seat utilization metrics
 * @access  Admin only
 */
router.get('/seats', auth(['admin']), AnalyticsController.getSeatUtilization);

/**
 * @route   GET /api/analytics/modules
 * @desc    Get VR module usage statistics
 * @access  Admin only
 */
router.get('/modules', auth(['admin']), AnalyticsController.getModuleUsage);

/**
 * @route   GET /api/analytics/time
 * @desc    Get time tracking metrics
 * @access  Admin only
 */
router.get('/time', auth(['admin']), AnalyticsController.getTimeMetrics);

module.exports = router;
