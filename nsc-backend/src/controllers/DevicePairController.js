const httpStatus = require('http-status');
const DevicePairService = require('../service/DevicePairService');
const logger = require('../config/logger');

class DevicePairController {
  constructor() {
    this.service = new DevicePairService();
  }

  /**
   * Create a new device pair
   * POST /device-pairs
   * Body: { pair_name, vr_device_id, chair_device_id, notes? }
   */
  create = async (req, res) => {
    try {
      const pair = await this.service.createPair(req.body);
      return res.status(httpStatus.CREATED).send({ status: true, data: pair });
    } catch (e) {
      logger.error('[DevicePairController.create]', e);
      return res.status(httpStatus.BAD_REQUEST).send({ status: false, message: e.message });
    }
  };

  /**
   * List all device pairs
   * GET /device-pairs?includeInactive=true
   */
  list = async (req, res) => {
    try {
      const { includeInactive } = req.query;
      const pairs = await this.service.listPairs({
        includeInactive: includeInactive === 'true',
      });
      return res.status(httpStatus.OK).send({ status: true, data: pairs });
    } catch (e) {
      logger.error('[DevicePairController.list]', e);
      return res.status(httpStatus.BAD_REQUEST).send({ status: false, message: e.message });
    }
  };

  /**
   * Get a single device pair by ID
   * GET /device-pairs/:id
   */
  getById = async (req, res) => {
    try {
      const { id } = req.params;
      const pair = await this.service.getPairById(id);
      return res.status(httpStatus.OK).send({ status: true, data: pair });
    } catch (e) {
      logger.error('[DevicePairController.getById]', e);
      return res.status(httpStatus.NOT_FOUND).send({ status: false, message: e.message });
    }
  };

  /**
   * Update a device pair
   * PATCH /device-pairs/:id
   * Body: { pair_name?, vr_device_id?, chair_device_id?, notes?, is_active? }
   */
  update = async (req, res) => {
    try {
      const { id } = req.params;
      const pair = await this.service.updatePair(id, req.body);
      return res.status(httpStatus.OK).send({ status: true, data: pair });
    } catch (e) {
      logger.error('[DevicePairController.update]', e);
      return res.status(httpStatus.BAD_REQUEST).send({ status: false, message: e.message });
    }
  };

  /**
   * Delete a device pair
   * DELETE /device-pairs/:id
   */
  remove = async (req, res) => {
    try {
      const { id } = req.params;
      await this.service.deletePair(id);
      return res.status(httpStatus.OK).send({ status: true, message: 'Pair deleted successfully' });
    } catch (e) {
      logger.error('[DevicePairController.remove]', e);
      return res.status(httpStatus.NOT_FOUND).send({ status: false, message: e.message });
    }
  };

  /**
   * Get available (unpaired) devices
   * GET /device-pairs/available/devices
   */
  getAvailableDevices = async (req, res) => {
    try {
      const devices = await this.service.getAvailableDevices();
      return res.status(httpStatus.OK).send({ status: true, data: devices });
    } catch (e) {
      logger.error('[DevicePairController.getAvailableDevices]', e);
      return res.status(httpStatus.BAD_REQUEST).send({ status: false, message: e.message });
    }
  };

  /**
   * Get online pairs (where at least one device is online)
   * GET /device-pairs/online
   */
  getOnlinePairs = async (req, res) => {
    try {
      const pairs = await this.service.getOnlinePairs();
      return res.status(httpStatus.OK).send({ status: true, data: pairs });
    } catch (e) {
      logger.error('[DevicePairController.getOnlinePairs]', e);
      return res.status(httpStatus.BAD_REQUEST).send({ status: false, message: e.message });
    }
  };
}

module.exports = DevicePairController;
