const httpStatus = require('http-status');
const SessionLogDao = require('../dao/SessionLogDao');
const responseHandler = require('../helper/responseHandler');
const logger = require('../config/logger');

class SessionLogService {
  constructor() {
    this.dao = new SessionLogDao();
  }

  create = async (payload) => {
    try {
      const created = await this.dao.create(payload);
      if (!created) {
        return responseHandler.returnError(httpStatus.BAD_REQUEST, 'Failed to create session log');
      }
      return responseHandler.returnSuccess(httpStatus.CREATED, 'Session log created', created);
    } catch (e) {
      logger.error(e);
      return responseHandler.returnError(httpStatus.BAD_GATEWAY, 'Something went wrong!');
    }
  };

  list = async ({ page = 1, limit = 20, session_id, journey_id, event }) => {
    try {
      const where = {};
      if (session_id) where.session_id = session_id;
      if (journey_id) where.journey_id = journey_id;
      if (event) where.event = event;

      const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
      const result = await this.dao.Model.findAndCountAll({
        where,
        limit: parseInt(limit, 10),
        offset,
        order: [['created_at', 'DESC']],
      });
      return responseHandler.returnSuccess(httpStatus.OK, 'Session logs fetched', {
        total: result.count,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        data: result.rows,
      });
    } catch (e) {
      logger.error(e);
      return responseHandler.returnError(httpStatus.BAD_GATEWAY, 'Something went wrong!');
    }
  };

  getById = async (id) => {
    try {
      const item = await this.dao.findById(id);
      if (!item) {
        return responseHandler.returnError(httpStatus.NOT_FOUND, 'Session log not found');
      }
      return responseHandler.returnSuccess(httpStatus.OK, 'Session log fetched', item);
    } catch (e) {
      logger.error(e);
      return responseHandler.returnError(httpStatus.BAD_GATEWAY, 'Something went wrong!');
    }
  };

  update = async (id, payload) => {
    try {
      const existing = await this.dao.findById(id);
      if (!existing) {
        return responseHandler.returnError(httpStatus.NOT_FOUND, 'Session log not found');
      }
      await this.dao.updateById(payload, id);
      const updated = await this.dao.findById(id);
      return responseHandler.returnSuccess(httpStatus.OK, 'Session log updated', updated);
    } catch (e) {
      logger.error(e);
      return responseHandler.returnError(httpStatus.BAD_GATEWAY, 'Something went wrong!');
    }
  };

  remove = async (id) => {
    try {
      const existing = await this.dao.findById(id);
      if (!existing) {
        return responseHandler.returnError(httpStatus.NOT_FOUND, 'Session log not found');
      }
      await this.dao.deleteByWhere({ id });
      return responseHandler.returnSuccess(httpStatus.OK, 'Session log deleted', {});
    } catch (e) {
      logger.error(e);
      return responseHandler.returnError(httpStatus.BAD_GATEWAY, 'Something went wrong!');
    }
  };
}

module.exports = SessionLogService;
