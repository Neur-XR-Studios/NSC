const httpStatus = require('http-status');
const AudioTrackService = require('../service/AudioTrackService');
const logger = require('../config/logger');

class AudioTrackController {
  constructor() {
    this.service = new AudioTrackService();
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

  list = async (req, res) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      const result = await this.service.list(page, limit);
      // Attach absolute URL for each audio item
      if (
        result &&
        result.response &&
        result.response.status &&
        result.response.data &&
        Array.isArray(result.response.data.data)
      ) {
        const base = `${req.protocol}://${req.get('host')}`;
        result.response.data.data = result.response.data.data.map((a) => {
          const obj = a && typeof a.toJSON === 'function' ? a.toJSON() : a;
          return { ...obj, url: `${base}/audio/${obj.audio_url}` };
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
      // Attach absolute URL
      if (result && result.response && result.response.status && result.response.data) {
        const base = `${req.protocol}://${req.get('host')}`;
        const a = result.response.data;
        const obj = a && typeof a.toJSON === 'function' ? a.toJSON() : a;
        result.response.data = { ...obj, url: `${base}/audio/${obj.audio_url}` };
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

module.exports = AudioTrackController;
