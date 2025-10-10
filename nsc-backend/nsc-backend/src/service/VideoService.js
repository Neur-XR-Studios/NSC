const httpStatus = require('http-status');
const path = require('path');
const fs = require('fs');
const { getVideoDurationInSeconds } = require('get-video-duration');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const VideoDao = require('../dao/VideoDao');
const responseHandler = require('../helper/responseHandler');
const logger = require('../config/logger');

// Configure ffmpeg binary if available
if (ffmpegInstaller && ffmpegInstaller.path && ffmpeg && typeof ffmpeg.setFfmpegPath === 'function') {
  try {
    ffmpeg.setFfmpegPath(ffmpegInstaller.path);
  } catch (e) {
    // Non-fatal; thumbnail generation will be skipped
    logger && logger.warn && logger.warn(`ffmpeg setup warning: ${e.message}`);
  }
}

class VideoService {
  constructor() {
    this.videoDao = new VideoDao();
    this.baseDir = path.join(__dirname, '..', 'public', 'video');
    this.thumbnailDir = path.join(__dirname, '..', 'public', 'thumbnails');
  }

  ensureStorageDir() {
    try {
      fs.mkdirSync(this.baseDir, { recursive: true });
      fs.mkdirSync(this.thumbnailDir, { recursive: true });
    } catch (e) {
      logger.error(e);
    }
  }

  async extractDurationMs(filePath) {
    try {
      const secs = await getVideoDurationInSeconds(filePath);
      return Math.round(secs * 1000);
    } catch (e) {
      // ffprobe/ffmpeg may be missing; ignore gracefully
      logger.warn ? logger.warn(e.message) : logger.error(e);
      return null;
    }
  }

  async generateThumbnail(filePath, storedFilename) {
    const base = storedFilename.replace(/\.[^/.]+$/, '');
    const outPath = path.join(this.thumbnailDir, `${base}.jpg`);
    return new Promise((resolve) => {
      try {
        if (!ffmpeg) return resolve(null);
        ffmpeg(filePath)
          .on('end', () => resolve(`${base}.jpg`))
          .on('error', (err) => {
            logger && logger.warn && logger.warn(`Thumbnail generation failed: ${err.message}`);
            resolve(null);
          })
          .screenshots({
            timestamps: ['1'],
            filename: `${base}.jpg`,
            folder: this.thumbnailDir,
            size: '640x?'
          });
      } catch (e) {
        logger && logger.warn && logger.warn(e.message);
        resolve(null);
      }
    });
  }

  // Create video record; file is required
  create = async (body, file) => {
    try {
      if (!file) {
        return responseHandler.returnError(httpStatus.BAD_REQUEST, 'Video file is required');
      }
      this.ensureStorageDir();
      const storedFilename = path.basename(file.filename || file.originalname);
      const filePath = path.join(this.baseDir, storedFilename);

      const durationMs = await this.extractDurationMs(filePath);
      // Best-effort thumbnail generation (non-blocking error handling)
      const generatedThumb = await this.generateThumbnail(filePath, storedFilename);

      const payload = {
        title: body.title,
        description: body.description,
        duration_ms: durationMs,
        video_url: storedFilename, // store only filename
        original_name: file.originalname || body.original_name || null,
        mime_type: file.mimetype || null,
        thumbnail_url: generatedThumb || null,
      };

      const created = await this.videoDao.create(payload);
      if (!created) {
        return responseHandler.returnError(httpStatus.BAD_REQUEST, 'Failed to create video');
      }
      return responseHandler.returnSuccess(httpStatus.CREATED, 'Video created', created);
    } catch (e) {
      logger.error(e);
      return responseHandler.returnError(httpStatus.BAD_GATEWAY, 'Something went wrong!');
    }
  };

  list = async (page = 1, limit = 20) => {
    try {
      const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
      const result = await this.videoDao.Model.findAndCountAll({
        limit: parseInt(limit, 10),
        offset,
        order: [['id', 'DESC']],
      });
      return responseHandler.returnSuccess(httpStatus.OK, 'Videos fetched', {
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
      const video = await this.videoDao.findById(id);
      if (!video) {
        return responseHandler.returnError(httpStatus.NOT_FOUND, 'Video not found');
      }
      return responseHandler.returnSuccess(httpStatus.OK, 'Video fetched', video);
    } catch (e) {
      logger.error(e);
      return responseHandler.returnError(httpStatus.BAD_GATEWAY, 'Something went wrong!');
    }
  };

  update = async (id, body, file) => {
    try {
      const existing = await this.videoDao.findById(id);
      if (!existing) {
        return responseHandler.returnError(httpStatus.NOT_FOUND, 'Video not found');
      }
      const updates = {
        title: body.title !== undefined ? body.title : existing.title,
        description: body.description !== undefined ? body.description : existing.description,
      };

      // Handle file replacement
      if (file) {
        this.ensureStorageDir();
        const newFilename = path.basename(file.filename || file.originalname);
        const newFilePath = path.join(this.baseDir, newFilename);
        // Try to compute new duration
        updates.duration_ms = await this.extractDurationMs(newFilePath);
        updates.video_url = newFilename;
        updates.original_name = file.originalname || updates.original_name;
        updates.mime_type = file.mimetype || updates.mime_type;
        // Regenerate thumbnail for new file
        const newThumb = await this.generateThumbnail(newFilePath, newFilename);
        if (newThumb) {
          updates.thumbnail_url = newThumb;
        }

        // Remove old file if different
        const oldFilename = existing.video_url;
        if (oldFilename && oldFilename !== newFilename) {
          const oldPath = path.join(this.baseDir, oldFilename);
          fs.existsSync(oldPath) && fs.unlink(oldPath, () => {});
        }
        // Remove old thumbnail if replaced
        const oldThumb = existing.thumbnail_url;
        if (oldThumb && oldThumb !== updates.thumbnail_url) {
          const oldThumbPath = path.join(this.thumbnailDir, oldThumb);
          fs.existsSync(oldThumbPath) && fs.unlink(oldThumbPath, () => {});
        }
      }

      await this.videoDao.updateById(updates, id);
      const updated = await this.videoDao.findById(id);
      return responseHandler.returnSuccess(httpStatus.OK, 'Video updated', updated);
    } catch (e) {
      logger.error(e);
      return responseHandler.returnError(httpStatus.BAD_GATEWAY, 'Something went wrong!');
    }
  };

  remove = async (id) => {
    try {
      const existing = await this.videoDao.findById(id);
      if (!existing) {
        return responseHandler.returnError(httpStatus.NOT_FOUND, 'Video not found');
      }
      const filename = existing.video_url;
      await this.videoDao.deleteByWhere({ id });
      // delete file best effort
      if (filename) {
        const filePath = path.join(this.baseDir, filename);
        fs.existsSync(filePath) && fs.unlink(filePath, () => {});
      }
      return responseHandler.returnSuccess(httpStatus.OK, 'Video deleted', {});
    } catch (e) {
      logger.error(e);
      return responseHandler.returnError(httpStatus.BAD_GATEWAY, 'Something went wrong!');
    }
  };
}

module.exports = VideoService;
