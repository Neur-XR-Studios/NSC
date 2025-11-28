const httpStatus = require('http-status');
const SessionFeedbackService = require('../service/SessionFeedbackService');
const logger = require('../config/logger');

class SessionFeedbackController {
    constructor() {
        this.service = new SessionFeedbackService();
    }

    create = async (req, res) => {
        try {
            const result = await this.service.createFeedback(req.body);
            return res.status(result.statusCode).send(result.response);
        } catch (e) {
            logger.error(e);
            return res.status(httpStatus.BAD_GATEWAY).send({ status: false, message: e.message });
        }
    };

    getBySessionId = async (req, res) => {
        try {
            const sessionId = req.params.sessionId;
            const result = await this.service.getFeedbackBySession(sessionId);
            return res.status(result.statusCode).send(result.response);
        } catch (e) {
            logger.error(e);
            return res.status(httpStatus.BAD_GATEWAY).send({ status: false, message: e.message });
        }
    };

    list = async (req, res) => {
        try {
            const { page, limit, search } = req.query;
            const result = await this.service.listFeedback({ page, limit, search });
            return res.status(result.statusCode).send(result.response);
        } catch (e) {
            logger.error(e);
            return res.status(httpStatus.BAD_GATEWAY).send({ status: false, message: e.message });
        }
    };

    getStats = async (req, res) => {
        try {
            const result = await this.service.getFeedbackStats();
            return res.status(result.statusCode).send(result.response);
        } catch (e) {
            logger.error(e);
            return res.status(httpStatus.BAD_GATEWAY).send({ status: false, message: e.message });
        }
    };
}

module.exports = SessionFeedbackController;
