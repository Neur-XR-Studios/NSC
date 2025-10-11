const httpStatus = require('http-status');
const SessionLogService = require('../service/SessionLogService');
const logger = require('../config/logger');

class SessionLogController {
  constructor() {
    this.service = new SessionLogService();
  }

  create = async (req, res) => {
    try {
      const result = await this.service.create(req.body);
      return res.status(result.statusCode).send(result.response);
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_GATEWAY).send({ status: false, message: e.message });
    }
  };

  list = async (req, res) => {
    try {
      const { page, limit, session_id, journey_id, event } = req.query;
      const result = await this.service.list({ page, limit, session_id, journey_id, event });
      return res.status(result.statusCode).send(result.response);
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_GATEWAY).send({ status: false, message: e.message });
    }
  };

  get = async (req, res) => {
    try {
      const id = req.params.id;
      const result = await this.service.getById(id);
      return res.status(result.statusCode).send(result.response);
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_GATEWAY).send({ status: false, message: e.message });
    }
  };

  update = async (req, res) => {
    try {
      const id = req.params.id;
      const result = await this.service.update(id, req.body);
      return res.status(result.statusCode).send(result.response);
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_GATEWAY).send({ status: false, message: e.message });
    }
  };

  remove = async (req, res) => {
    try {
      const id = req.params.id;
      const result = await this.service.remove(id);
      return res.status(result.statusCode).send(result.response);
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_GATEWAY).send({ status: false, message: e.message });
    }
  };
}

module.exports = SessionLogController;
