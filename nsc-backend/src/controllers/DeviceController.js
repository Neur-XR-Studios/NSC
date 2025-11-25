const httpStatus = require('http-status');
const PairingService = require('../service/PairingService');
const deviceDiscoveryService = require('../service/DeviceDiscoveryService');
const logger = require('../config/logger');

class DeviceController {
  constructor() {
    this.service = new PairingService();
  }

  generateCode = async (req, res) => {
    try {
      const { type } = req.body; // 'vr' | 'chair'
      const data = await this.service.generateCode(type);
      return res.status(httpStatus.OK).send({ status: true, data });
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_REQUEST).send({ status: false, message: e.message });
    }
  };

  // Generate a bundle code to register VR + Chair with one code
  generateBundleCode = async (req, res) => {
    try {
      const { target_pair_id = null } = req.body || {};
      const data = await this.service.generateBundleCode({ target_pair_id });
      return res.status(httpStatus.OK).send({ status: true, data });
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_REQUEST).send({ status: false, message: e.message });
    }
  };

  register = async (req, res) => {
    try {
      const { type, code, bundleCode, deviceId, metadata } = req.body;
      // If bundleCode provided, use bundle registration path
      if (bundleCode) {
        const result = await this.service.registerWithBundle({ bundleCode, type, deviceId, metadata });
        return res.status(httpStatus.OK).send({ status: true, data: { device: result.device, bundle: result.bundle, pair: result.devicePair } });
      }
      // Fallback: if a 6-digit code is sent and matches a bundle, treat it as bundleCode
      if (code && /^\d{6}$/.test(String(code))) {
        try {
          const result = await this.service.registerWithBundle({ bundleCode: String(code), type, deviceId, metadata });
          return res.status(httpStatus.OK).send({ status: true, data: { device: result.device, bundle: result.bundle, pair: result.devicePair } });
        } catch (e) {
          // ignore and try legacy per-type code below
        }
      }
      const device = await this.service.registerWithCode({ type, code, deviceId, metadata });
      // Emit that a single device registered (legacy path)
      try { global.io?.emit('pairing:device_registered', { type, id: device.id, deviceId: device.deviceId }); } catch {}
      return res.status(httpStatus.OK).send({ status: true, data: device });
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_REQUEST).send({ status: false, message: e.message });
    }
  };

  // Get bundle pairing status for polling fallback
  getBundleStatus = async (req, res) => {
    try {
      const { code } = req.params;
      const data = await this.service.getBundleStatus(code);
      return res.status(httpStatus.OK).send({ status: true, data });
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_REQUEST).send({ status: false, message: e.message });
    }
  };

  list = async (req, res) => {
    try {
      return res.status(httpStatus.GONE).send({
        status: false,
        message:
          'This endpoint has been removed. Use /device-pairs for listing and managing VR–Chair pairs. For available unpaired devices use /device-pairs/available/devices.',
      });
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_REQUEST).send({ status: false, message: e.message });
    }
  };

  // Device Discovery Methods
  discover = async (req, res) => {
    try {
      const requestId = deviceDiscoveryService.requestDeviceScan();
      return res.status(httpStatus.OK).send({
        status: true,
        message: 'Device scan initiated',
        requestId
      });
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_REQUEST).send({ status: false, message: e.message });
    }
  };

  getDiscovered = async (req, res) => {
    try {
      const devices = deviceDiscoveryService.getDiscoveredDevices();
      return res.status(httpStatus.OK).send({ status: true, data: devices });
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_REQUEST).send({ status: false, message: e.message });
    }
  };

  sendCommand = async (req, res) => {
    try {
      const { deviceId } = req.params;
      const { command, payload } = req.body;

      if (!command) {
        return res.status(httpStatus.BAD_REQUEST).send({
          status: false,
          message: 'Command is required'
        });
      }

      const requestId = deviceDiscoveryService.sendDeviceCommand(deviceId, command, payload);
      return res.status(httpStatus.OK).send({
        status: true,
        message: 'Command sent',
        requestId
      });
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_REQUEST).send({ status: false, message: e.message });
    }
  };
}

module.exports = DeviceController;
