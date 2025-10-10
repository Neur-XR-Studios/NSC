const httpStatus = require('http-status');
const path = require('path');
const fs = require('fs');
const md5 = require('md5');
const TelemetryDao = require('../dao/TelemetryDao');
const responseHandler = require('../helper/responseHandler');
const logger = require('../config/logger');

class TelemetryService {
  constructor() {
    this.telemetryDao = new TelemetryDao();
    this.baseDir = path.join(__dirname, '..', 'public', 'telemetry');
  }

  ensureStorageDir() {
    try {
      fs.mkdirSync(this.baseDir, { recursive: true });
    } catch (e) {
      logger.error(e);
    }
  }

  // Validate that a file contains valid JSON
  async isValidJson(filePath) {
    try {
      const data = await fs.promises.readFile(filePath, 'utf8');
      JSON.parse(data);
      return true;
    } catch (e) {
      return false;
    }
  }

  async computeChecksum(filePath) {
    const buf = await fs.promises.readFile(filePath);
    return md5(buf);
  }

  create = async (body, file) => {
    try {
      if (!file) {
        return responseHandler.returnError(httpStatus.BAD_REQUEST, 'Telemetry JSON file is required');
      }
      this.ensureStorageDir();
      const storedFilename = path.basename(file.filename || file.originalname);
      const filePath = path.join(this.baseDir, storedFilename);

      // Validate JSON
      const valid = await this.isValidJson(filePath);
      if (!valid) {
        // cleanup invalid file
        fs.existsSync(filePath) && fs.unlink(filePath, () => {});
        return responseHandler.returnError(httpStatus.BAD_REQUEST, 'Invalid JSON uploaded');
      }

      const checksum = await this.computeChecksum(filePath);

      const payload = {
        video_id: body.video_id || null, // kept separate; not enforcing FK
        version: body.version || null,
        format: body.format || 'json',
        telemetry_url: storedFilename, // only filename
        checksum,
      };

      const created = await this.telemetryDao.create(payload);
      if (!created) {
        return responseHandler.returnError(httpStatus.BAD_REQUEST, 'Failed to create telemetry');
      }
      return responseHandler.returnSuccess(httpStatus.CREATED, 'Telemetry created', created);
    } catch (e) {
      logger.error(e);
      return responseHandler.returnError(httpStatus.BAD_GATEWAY, 'Something went wrong!');
    }
  };

  list = async (page = 1, limit = 20) => {
    try {
      const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
      const result = await this.telemetryDao.Model.findAndCountAll({
        limit: parseInt(limit, 10),
        offset,
        order: [['id', 'DESC']],
      });
      return responseHandler.returnSuccess(httpStatus.OK, 'Telemetry records fetched', {
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
      const row = await this.telemetryDao.findById(id);
      if (!row) {
        return responseHandler.returnError(httpStatus.NOT_FOUND, 'Telemetry not found');
      }
      return responseHandler.returnSuccess(httpStatus.OK, 'Telemetry fetched', row);
    } catch (e) {
      logger.error(e);
      return responseHandler.returnError(httpStatus.BAD_GATEWAY, 'Something went wrong!');
    }
  };

  update = async (id, body, file) => {
    try {
      const existing = await this.telemetryDao.findById(id);
      if (!existing) {
        return responseHandler.returnError(httpStatus.NOT_FOUND, 'Telemetry not found');
      }
      const updates = {
        video_id: body.video_id !== undefined ? body.video_id : existing.video_id,
        version: body.version !== undefined ? body.version : existing.version,
        format: body.format !== undefined ? body.format : existing.format,
      };

      if (file) {
        this.ensureStorageDir();
        const newFilename = path.basename(file.filename || file.originalname);
        const newFilePath = path.join(this.baseDir, newFilename);
        const valid = await this.isValidJson(newFilePath);
        if (!valid) {
          fs.existsSync(newFilePath) && fs.unlink(newFilePath, () => {});
          return responseHandler.returnError(httpStatus.BAD_REQUEST, 'Invalid JSON uploaded');
        }
        updates.telemetry_url = newFilename;
        updates.checksum = await this.computeChecksum(newFilePath);

        const oldFilename = existing.telemetry_url;
        if (oldFilename && oldFilename !== newFilename) {
          const oldPath = path.join(this.baseDir, oldFilename);
          fs.existsSync(oldPath) && fs.unlink(oldPath, () => {});
        }
      }

      await this.telemetryDao.updateById(updates, id);
      const updated = await this.telemetryDao.findById(id);
      return responseHandler.returnSuccess(httpStatus.OK, 'Telemetry updated', updated);
    } catch (e) {
      logger.error(e);
      return responseHandler.returnError(httpStatus.BAD_GATEWAY, 'Something went wrong!');
    }
  };

  remove = async (id) => {
    try {
      const existing = await this.telemetryDao.findById(id);
      if (!existing) {
        return responseHandler.returnError(httpStatus.NOT_FOUND, 'Telemetry not found');
      }
      const filename = existing.telemetry_url;
      await this.telemetryDao.deleteByWhere({ id });
      if (filename) {
        const filePath = path.join(this.baseDir, filename);
        fs.existsSync(filePath) && fs.unlink(filePath, () => {});
      }
      return responseHandler.returnSuccess(httpStatus.OK, 'Telemetry deleted', {});
    } catch (e) {
      logger.error(e);
      return responseHandler.returnError(httpStatus.BAD_GATEWAY, 'Something went wrong!');
    }
  };
}

module.exports = TelemetryService;
