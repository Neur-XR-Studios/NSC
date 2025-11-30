const httpStatus = require('http-status');
const AnalyticsService = require('../service/AnalyticsService');
const logger = require('../config/logger');

class AnalyticsController {
    constructor() {
        this.service = new AnalyticsService();
    }

    /**
     * Get analytics overview
     */
    getOverview = async (req, res) => {
        try {
            const { startDate, endDate } = req.query;
            const data = await this.service.getOverview(startDate, endDate);

            res.status(httpStatus.OK).json({
                status: true,
                data,
            });
        } catch (error) {
            logger.error('Error fetching analytics overview:', error);
            res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
                status: false,
                message: 'Failed to fetch analytics overview',
                error: error.message,
            });
        }
    };

    /**
     * Get session metrics
     */
    getSessionMetrics = async (req, res) => {
        try {
            const { startDate, endDate } = req.query;
            const data = await this.service.getSessionMetrics(startDate, endDate);

            res.status(httpStatus.OK).json({
                status: true,
                data,
            });
        } catch (error) {
            logger.error('Error fetching session metrics:', error);
            res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
                status: false,
                message: 'Failed to fetch session metrics',
                error: error.message,
            });
        }
    };

    /**
     * Get seat utilization metrics
     */
    getSeatUtilization = async (req, res) => {
        try {
            const { startDate, endDate } = req.query;
            const data = await this.service.getSeatUtilization(startDate, endDate);

            res.status(httpStatus.OK).json({
                status: true,
                data,
            });
        } catch (error) {
            logger.error('Error fetching seat utilization:', error);
            res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
                status: false,
                message: 'Failed to fetch seat utilization',
                error: error.message,
            });
        }
    };

    /**
     * Get module usage statistics
     */
    getModuleUsage = async (req, res) => {
        try {
            const { startDate, endDate } = req.query;
            const data = await this.service.getModuleUsage(startDate, endDate);

            res.status(httpStatus.OK).json({
                status: true,
                data,
            });
        } catch (error) {
            logger.error('Error fetching module usage:', error);
            res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
                status: false,
                message: 'Failed to fetch module usage',
                error: error.message,
            });
        }
    };

    /**
     * Get time tracking metrics
     */
    getTimeMetrics = async (req, res) => {
        try {
            const { startDate, endDate } = req.query;
            const data = await this.service.getTimeMetrics(startDate, endDate);

            res.status(httpStatus.OK).json({
                status: true,
                data,
            });
        } catch (error) {
            logger.error('Error fetching time metrics:', error);
            res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
                status: false,
                message: 'Failed to fetch time metrics',
                error: error.message,
            });
        }
    };
}

module.exports = new AnalyticsController();
