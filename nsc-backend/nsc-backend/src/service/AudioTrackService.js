const httpStatus = require('http-status');
const path = require('path');
const fs = require('fs');
const mm = require('music-metadata');
const AudioTrackDao = require('../dao/AudioTrackDao');
const responseHandler = require('../helper/responseHandler');
const logger = require('../config/logger');

class AudioTrackService {
  constructor() {
    this.audioDao = new AudioTrackDao();
    this.baseDir = path.join(__dirname, '..', 'public', 'audio');
  }

  ensureStorageDir() {
    try {
      fs.mkdirSync(this.baseDir, { recursive: true });
    } catch (e) {
      logger.error(e);
    }
  }

  async extractAudioMeta(filePath) {
    try {
      const metadata = await mm.parseFile(filePath);
      const { numberOfChannels, sampleRate, duration, format } = metadata.format || {};
      const durationMs = Number.isFinite(duration) ? Math.round(duration * 1000) : null;

      return {
        channels: Number.isFinite(numberOfChannels) ? numberOfChannels : null,
        sample_rate_hz: Number.isFinite(sampleRate) ? sampleRate : null,
        duration_ms: durationMs,
        mime_type: format && format.mimeType ? format.mimeType : null,
      };
    } catch (e) {
      logger.warn ? logger.warn(e.message) : logger.error(e);
      return { channels: null, sample_rate_hz: null, duration_ms: null, mime_type: null };
    }
  }

  create = async (body, file) => {
    try {
      if (!file) {
        return responseHandler.returnError(httpStatus.BAD_REQUEST, 'Audio file is required');
      }

      this.ensureStorageDir();
      const storedFilename = path.basename(file.filename || file.originalname);
      const filePath = path.join(this.baseDir, storedFilename);

      const meta = await this.extractAudioMeta(filePath);

      const payload = {
        language_code: body.language_code || null,
        channels: meta.channels,
        sample_rate_hz: meta.sample_rate_hz,
        duration_ms: meta.duration_ms,
        audio_url: storedFilename,
        mime_type: file.mimetype || meta.mime_type,
      };

      const created = await this.audioDao.create(payload);
      if (!created) {
        return responseHandler.returnError(httpStatus.BAD_REQUEST, 'Failed to create audio track');
      }
      return responseHandler.returnSuccess(httpStatus.CREATED, 'Audio track created', created);
    } catch (e) {
      logger.error(e);
      return responseHandler.returnError(httpStatus.BAD_GATEWAY, 'Something went wrong!');
    }
  };

  list = async (page = 1, limit = 20, videoId = null) => {
    try {
      const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
      const result = await this.audioDao.Model.findAndCountAll({
        limit: parseInt(limit, 10),
        offset,
        order: [['id', 'DESC']],
      });
      return responseHandler.returnSuccess(httpStatus.OK, 'Audio tracks fetched', {
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
      const row = await this.audioDao.findById(id);
      if (!row) {
        return responseHandler.returnError(httpStatus.NOT_FOUND, 'Audio track not found');
      }
      return responseHandler.returnSuccess(httpStatus.OK, 'Audio track fetched', row);
    } catch (e) {
      logger.error(e);
      return responseHandler.returnError(httpStatus.BAD_GATEWAY, 'Something went wrong!');
    }
  };

  update = async (id, body, file) => {
    try {
      const existing = await this.audioDao.findById(id);
      if (!existing) {
        return responseHandler.returnError(httpStatus.NOT_FOUND, 'Audio track not found');
      }
      const updates = {
        language_code: body.language_code !== undefined ? body.language_code : existing.language_code,
      };

      if (file) {
        this.ensureStorageDir();
        const newFilename = path.basename(file.filename || file.originalname);
        const newFilePath = path.join(this.baseDir, newFilename);
        const meta = await this.extractAudioMeta(newFilePath);
        updates.channels = meta.channels;
        updates.sample_rate_hz = meta.sample_rate_hz;
        updates.duration_ms = meta.duration_ms;
        updates.audio_url = newFilename;
        updates.mime_type = file.mimetype || meta.mime_type;

        const oldFilename = existing.audio_url;
        if (oldFilename && oldFilename !== newFilename) {
          const oldPath = path.join(this.baseDir, oldFilename);
          fs.existsSync(oldPath) && fs.unlink(oldPath, () => { });
        }
      }

      await this.audioDao.updateById(updates, id);
      const updated = await this.audioDao.findById(id);
      return responseHandler.returnSuccess(httpStatus.OK, 'Audio track updated', updated);
    } catch (e) {
      logger.error(e);
      return responseHandler.returnError(httpStatus.BAD_GATEWAY, 'Something went wrong!');
    }
  };

  remove = async (id) => {
    try {
      const existing = await this.audioDao.findById(id);
      if (!existing) {
        return responseHandler.returnError(httpStatus.NOT_FOUND, 'Audio track not found');
      }
      const filename = existing.audio_url;
      await this.audioDao.deleteByWhere({ id });
      if (filename) {
        const filePath = path.join(this.baseDir, filename);
        fs.existsSync(filePath) && fs.unlink(filePath, () => { });
      }
      return responseHandler.returnSuccess(httpStatus.OK, 'Audio track deleted', {});
    } catch (e) {
      logger.error(e);
      return responseHandler.returnError(httpStatus.BAD_GATEWAY, 'Something went wrong!');
    }
  };
}

module.exports = AudioTrackService;
