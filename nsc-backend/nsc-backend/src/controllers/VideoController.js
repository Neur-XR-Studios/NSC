const httpStatus = require('http-status');
const VideoService = require('../service/VideoService');
const logger = require('../config/logger');

class VideoController {
  constructor() {
    this.videoService = new VideoService();
  }

  // POST /api/videos
  create = async (req, res) => {
    try {
      const result = await this.videoService.create(req.body, req.file);
      return res.status(result.statusCode).send(result.response);
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_GATEWAY).send(e);
    }
  };

  // GET /api/videos
  list = async (req, res) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      const result = await this.videoService.list(page, limit);
      // Attach absolute URL for each item in list
      if (
        result &&
        result.response &&
        result.response.status &&
        result.response.data &&
        Array.isArray(result.response.data.data)
      ) {
        const base = `${req.protocol}://${req.get('host')}`;
        result.response.data.data = result.response.data.data.map((v) => {
          const obj = v && typeof v.toJSON === 'function' ? v.toJSON() : v;
          const thumbFile = obj.thumbnail_url || ((obj.video_url || '').replace(/\.[^/.]+$/, '') + '.jpg');
          return {
            ...obj,
            url: `${base}/video/${obj.video_url}`,
            thumbnail_url: thumbFile,
            thumbnail: thumbFile ? `${base}/thumbnails/${thumbFile}` : null,
          };
        });
      }
      return res.status(result.statusCode).send(result.response);
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_GATEWAY).send(e);
    }
  };

  // GET /api/videos/:id
  get = async (req, res) => {
    try {
      const result = await this.videoService.getById(req.params.id);
      // Attach absolute URL for single item
      if (result && result.response && result.response.status && result.response.data) {
        const base = `${req.protocol}://${req.get('host')}`;
        const v = result.response.data;
        const obj = v && typeof v.toJSON === 'function' ? v.toJSON() : v;
        const thumbFile = obj.thumbnail_url || ((obj.video_url || '').replace(/\.[^/.]+$/, '') + '.jpg');
        result.response.data = {
          ...obj,
          url: `${base}/video/${obj.video_url}`,
          thumbnail_url: thumbFile,
          thumbnail: thumbFile ? `${base}/thumbnails/${thumbFile}` : null,
        };
      }
      return res.status(result.statusCode).send(result.response);
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_GATEWAY).send(e);
    }
  };

  // PUT /api/videos/:id (optional new file)
  update = async (req, res) => {
    try {
      const result = await this.videoService.update(req.params.id, req.body, req.file);
      return res.status(result.statusCode).send(result.response);
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_GATEWAY).send(e);
    }
  };

  // DELETE /api/videos/:id
  remove = async (req, res) => {
    try {
      const result = await this.videoService.remove(req.params.id);
      return res.status(result.statusCode).send(result.response);
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_GATEWAY).send(e);
    }
  };
}

module.exports = VideoController;
