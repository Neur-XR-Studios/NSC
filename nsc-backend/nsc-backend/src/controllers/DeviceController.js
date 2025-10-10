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

  register = async (req, res) => {
    try {
      const { type, code, deviceId, metadata } = req.body;
      const device = await this.service.registerWithCode({ type, code, deviceId, metadata });
      return res.status(httpStatus.OK).send({ status: true, data: device });
    } catch (e) {
      logger.error(e);
      return res.status(httpStatus.BAD_REQUEST).send({ status: false, message: e.message });
    }
  };

  list = async (req, res) => {
    try {
      const data = await this.service.listDevices();
      return res.status(httpStatus.OK).send({ status: true, data });
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
