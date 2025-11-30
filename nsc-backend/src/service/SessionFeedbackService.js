const httpStatus = require('http-status');
const SessionFeedbackDao = require('../dao/SessionFeedbackDao');
const logger = require('../config/logger');

class SessionFeedbackService {
    constructor() {
        this.dao = new SessionFeedbackDao();
    }

    async createFeedback({ session_id, rating, feedback_text }) {
        try {
            // Validate rating range
            if (!rating || rating < 1 || rating > 5) {
                return {
                    statusCode: httpStatus.BAD_REQUEST,
                    response: { status: false, message: 'Rating must be between 1 and 5' },
                };
            }

            // Validate session exists
            const { Session } = require('../models');
            const session = await Session.findByPk(session_id);
            if (!session) {
                return {
                    statusCode: httpStatus.NOT_FOUND,
                    response: { status: false, message: 'Session not found' },
                };
            }

            // Create feedback
            const feedback = await this.dao.create({
                session_id,
                rating: parseInt(rating, 10),
                feedback_text: feedback_text || null,
            });

            return {
                statusCode: httpStatus.CREATED,
                response: {
                    status: true,
                    message: 'Feedback created successfully',
                    data: feedback,
                },
            };
        } catch (error) {
            logger.error('Error creating feedback:', error);
            return {
                statusCode: httpStatus.INTERNAL_SERVER_ERROR,
                response: { status: false, message: error.message },
            };
        }
    }

    async getFeedbackBySession(sessionId) {
        try {
            const feedback = await this.dao.findBySessionId(sessionId);

            if (!feedback) {
                return {
                    statusCode: httpStatus.NOT_FOUND,
                    response: { status: false, message: 'No feedback found for this session' },
                };
            }

            return {
                statusCode: httpStatus.OK,
                response: {
                    status: true,
                    data: feedback,
                },
            };
        } catch (error) {
            logger.error('Error getting feedback by session:', error);
            return {
                statusCode: httpStatus.INTERNAL_SERVER_ERROR,
                response: { status: false, message: error.message },
            };
        }
    }

    async listFeedback({ page = 1, limit = 10, search = '' }) {
        try {
            const result = await this.dao.findAll({ page, limit, search });

            return {
                statusCode: httpStatus.OK,
                response: {
                    status: true,
                    message: 'Feedbacks fetched successfully',
                    data: result,
                },
            };
        } catch (error) {
            logger.error('Error listing feedbacks:', error);
            return {
                statusCode: httpStatus.INTERNAL_SERVER_ERROR,
                response: { status: false, message: error.message },
            };
        }
    }

    async getFeedbackStats() {
        try {
            const stats = await this.dao.getStats();

            return {
                statusCode: httpStatus.OK,
                response: {
                    status: true,
                    data: stats,
                },
            };
        } catch (error) {
            logger.error('Error getting feedback stats:', error);
            return {
                statusCode: httpStatus.INTERNAL_SERVER_ERROR,
                response: { status: false, message: error.message },
            };
        }
    }
}

module.exports = SessionFeedbackService;
