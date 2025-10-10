const httpStatus = require('http-status');
const TelemetryService = require('../service/TelemetryService');
const logger = require('../config/logger');

class TelemetryController {
  constructor() {
    this.service = new TelemetryService();
  }

  create = async (req, res) => {
    try {
      const result = await this.service.create(req.body, req.file);
      return res.status(result.statusCode).send(result.response);
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_GATEWAY).send(e);
    }
  };

  // GET /api/telemetry
  list = async (req, res) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      const result = await this.service.list(page, limit);

      // attach absolute URL for each telemetry item
      if (
        result &&
        result.response &&
        result.response.status &&
        result.response.data &&
        Array.isArray(result.response.data.data)
      ) {
        const base = `${req.protocol}://${req.get('host')}`;
        result.response.data.data = result.response.data.data.map((t) => {
          const obj = t && typeof t.toJSON === 'function' ? t.toJSON() : t;
          return { ...obj, url: `${base}/telemetry/${obj.telemetry_url}` };
        });
      }

      return res.status(result.statusCode).send(result.response);
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_GATEWAY).send(e);
    }
  };

  get = async (req, res) => {
    try {
      const result = await this.service.getById(req.params.id);

      if (result && result.response && result.response.status && result.response.data) {
        const base = `${req.protocol}://${req.get('host')}`;
        const t = result.response.data;
        const obj = t && typeof t.toJSON === 'function' ? t.toJSON() : t;
        result.response.data = { ...obj, url: `${base}/telemetry/${obj.telemetry_url}` };
      }

      return res.status(result.statusCode).send(result.response);
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_GATEWAY).send(e);
    }
  };

  update = async (req, res) => {
    try {
      const result = await this.service.update(req.params.id, req.body, req.file);
      return res.status(result.statusCode).send(result.response);
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_GATEWAY).send(e);
    }
  };

  remove = async (req, res) => {
    try {
      const result = await this.service.remove(req.params.id);
      return res.status(result.statusCode).send(result.response);
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_GATEWAY).send(e);
    }
  };
}

module.exports = TelemetryController;
