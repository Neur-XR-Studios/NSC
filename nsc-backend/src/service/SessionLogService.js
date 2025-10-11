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
      if (journey_id !== undefined && journey_id !== null && `${journey_id}` !== '') {
        const jId = Number(journey_id);
        if (!Number.isNaN(jId)) where.journey_id = jId;
      }
      if (event) where.event = event;

      // Safely parse pagination values to avoid NaN in LIMIT/OFFSET
      const pageNumRaw = Number(page);
      const limitNumRaw = Number(limit);
      const pageNum = Number.isFinite(pageNumRaw) && pageNumRaw > 0 ? Math.floor(pageNumRaw) : 1;
      const limitNum = Number.isFinite(limitNumRaw) && limitNumRaw > 0 ? Math.floor(limitNumRaw) : 20;
      const offset = (pageNum - 1) * limitNum;
      const result = await this.dao.Model.findAndCountAll({
        where,
        limit: limitNum,
        offset: offset,
        order: [['created_at', 'DESC']],
      });
      return responseHandler.returnSuccess(httpStatus.OK, 'Session logs fetched', {
        total: result.count,
        page: pageNum,
        limit: limitNum,
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
