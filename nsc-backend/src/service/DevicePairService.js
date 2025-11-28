const { Op } = require('sequelize');
const { DevicePair, VRDevice, ChairDevice, sequelize } = require('../models');
const logger = require('../config/logger');

class DevicePairService {
  /**
   * Create a new device pair
   * @param {Object} data - { pair_name, vr_device_id, chair_device_id, notes? }
   * @returns {Promise<Object>}
   */
  async createPair(data) {
    const { pair_name, vr_device_id, chair_device_id, notes } = data;

    // Validate required fields
    if (!pair_name || !vr_device_id || !chair_device_id) {
      throw new Error('pair_name, vr_device_id, and chair_device_id are required');
    }

    // Check if devices exist
    const vr = await VRDevice.findByPk(vr_device_id);
    const chair = await ChairDevice.findByPk(chair_device_id);

    if (!vr) {
      throw new Error(`VR device not found: ${vr_device_id}`);
    }
    if (!chair) {
      throw new Error(`Chair device not found: ${chair_device_id}`);
    }

    // Check if pair already exists (including inactive pairs)
    const existingPair = await DevicePair.findOne({
      where: {
        [Op.or]: [
          { vr_device_id, chair_device_id },
          { vr_device_id },
          { chair_device_id },
        ],
      },
    });

    if (existingPair) {
      throw new Error('One or both devices are already paired');
    }

    // Ensure devices have display names
    const vrDisplayName = await this.ensureDisplayName(vr, 'vr');
    const chairDisplayName = await this.ensureDisplayName(chair, 'chair');

    // Generate readable pair name if not provided or if it's the ugly format
    let finalPairName = pair_name;
    if (!pair_name || pair_name.includes('kjwbbbd') || pair_name.startsWith('Pair ')) {
      finalPairName = `${vrDisplayName} + ${chairDisplayName}`;
      logger.info(`Generated readable pair name: ${finalPairName}`);
    }

    // Create the pair
    const pair = await DevicePair.create({
      pair_name: finalPairName,
      vr_device_id,
      chair_device_id,
      notes: notes || null,
      is_active: true,
    });

    // Return with associations
    return await this.getPairById(pair.id);
  }

  /**
   * Get all device pairs with their associated devices
   * @param {Object} options - { includeInactive: boolean }
   * @returns {Promise<Array>}
   */
  async listPairs({ includeInactive = false } = {}) {
    const deviceDiscoveryService = require('./DeviceDiscoveryService');
    const where = includeInactive ? {} : { is_active: true };
    const onlineThreshold = new Date(Date.now() - 30 * 1000);

    const pairs = await DevicePair.findAll({
      where,
      include: [
        {
          model: VRDevice,
          as: 'vr',
          attributes: ['id', 'deviceId', 'display_name', 'metadata', 'lastSeenAt'],
        },
        {
          model: ChairDevice,
          as: 'chair',
          attributes: ['id', 'deviceId', 'display_name', 'metadata', 'lastSeenAt'],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    // Add real-time online status to each pair
    return pairs.map(pair => {
      const vrOnlineRealtime = pair.vr?.deviceId ? deviceDiscoveryService.isDeviceOnline(pair.vr.deviceId) : false;
      const chairOnlineRealtime = pair.chair?.deviceId ? deviceDiscoveryService.isDeviceOnline(pair.chair.deviceId) : false;

      const vrOnlineDb = pair.vr?.lastSeenAt && new Date(pair.vr.lastSeenAt) > onlineThreshold;
      const chairOnlineDb = pair.chair?.lastSeenAt && new Date(pair.chair.lastSeenAt) > onlineThreshold;

      const vrOnline = vrOnlineRealtime || vrOnlineDb;
      const chairOnline = chairOnlineRealtime || chairOnlineDb;

      return {
        ...pair.toJSON(),
        vrOnline,
        chairOnline,
        bothOnline: vrOnline && chairOnline,
      };
    });
  }

  /**
   * Get a single pair by ID
   * @param {string} pairId
   * @returns {Promise<Object>}
   */
  async getPairById(pairId) {
    const pair = await DevicePair.findByPk(pairId, {
      include: [
        {
          model: VRDevice,
          as: 'vr',
          attributes: ['id', 'deviceId', 'display_name', 'metadata', 'lastSeenAt'],
        },
        {
          model: ChairDevice,
          as: 'chair',
          attributes: ['id', 'deviceId', 'display_name', 'metadata', 'lastSeenAt'],
        },
      ],
    });

    if (!pair) {
      throw new Error('Pair not found');
    }

    return pair;
  }

  /**
   * Update a device pair
   * @param {string} pairId
   * @param {Object} updates - { pair_name?, vr_device_id?, chair_device_id?, notes?, is_active? }
   * @returns {Promise<Object>}
   */
  async updatePair(pairId, updates) {
    const pair = await DevicePair.findByPk(pairId);
    if (!pair) {
      throw new Error('Pair not found');
    }

    const { pair_name, vr_device_id, chair_device_id, notes, is_active } = updates;

    // If updating devices, validate they exist and aren't already paired elsewhere
    if (vr_device_id && vr_device_id !== pair.vr_device_id) {
      const vr = await VRDevice.findByPk(vr_device_id);
      if (!vr) {
        throw new Error(`VR device not found: ${vr_device_id}`);
      }

      // Check if VR is already paired elsewhere
      const existingPair = await DevicePair.findOne({
        where: {
          vr_device_id,
          id: { [Op.ne]: pairId },
        },
      });
      if (existingPair) {
        throw new Error('VR device is already paired elsewhere');
      }
    }

    if (chair_device_id && chair_device_id !== pair.chair_device_id) {
      const chair = await ChairDevice.findByPk(chair_device_id);
      if (!chair) {
        throw new Error(`Chair device not found: ${chair_device_id}`);
      }

      // Check if Chair is already paired elsewhere
      const existingPair = await DevicePair.findOne({
        where: {
          chair_device_id,
          id: { [Op.ne]: pairId },
        },
      });
      if (existingPair) {
        throw new Error('Chair device is already paired elsewhere');
      }
    }

    // Update the pair
    await pair.update({
      pair_name: pair_name !== undefined ? pair_name : pair.pair_name,
      vr_device_id: vr_device_id || pair.vr_device_id,
      chair_device_id: chair_device_id || pair.chair_device_id,
      notes: notes !== undefined ? notes : pair.notes,
      is_active: is_active !== undefined ? is_active : pair.is_active,
    });

    // Return updated pair with associations
    return await this.getPairById(pairId);
  }

  /**
   * Delete a device pair
   * @param {string} pairId
   * @returns {Promise<void>}
   */
  async deletePair(pairId) {
    const pair = await DevicePair.findByPk(pairId);
    if (!pair) {
      throw new Error('Pair not found');
    }

    await pair.destroy();
  }

  /**
   * Get available (unpaired) devices
   * @returns {Promise<Object>} { vrDevices: [], chairDevices: [] }
   */
  async getAvailableDevices() {
    // Get all paired device IDs
    const pairs = await DevicePair.findAll({
      where: { is_active: true },
      attributes: ['vr_device_id', 'chair_device_id'],
    });

    const pairedVrIds = pairs.map(p => p.vr_device_id);
    const pairedChairIds = pairs.map(p => p.chair_device_id);

    // Get unpaired devices
    const [vrDevices, chairDevices] = await Promise.all([
      VRDevice.findAll({
        where: {
          id: { [Op.notIn]: pairedVrIds.length > 0 ? pairedVrIds : [''] },
        },
        order: [['created_at', 'DESC']],
      }),
      ChairDevice.findAll({
        where: {
          id: { [Op.notIn]: pairedChairIds.length > 0 ? pairedChairIds : [''] },
        },
        order: [['created_at', 'DESC']],
      }),
    ]);

    return { vrDevices, chairDevices };
  }

  /**
   * Get online pairs (where at least one device is online)
   * A device is considered online if:
   * 1. It's in DeviceDiscoveryService memory (real-time check), OR
   * 2. lastSeenAt is within the last 30 seconds (database fallback)
   * @returns {Promise<Array>}
   */
  async getOnlinePairs() {
    const deviceDiscoveryService = require('./DeviceDiscoveryService');
    const onlineThreshold = new Date(Date.now() - 30 * 1000); // 30 seconds ago

    const pairs = await DevicePair.findAll({
      where: { is_active: true },
      include: [
        {
          model: VRDevice,
          as: 'vr',
          attributes: ['id', 'deviceId', 'display_name', 'metadata', 'lastSeenAt'],
        },
        {
          model: ChairDevice,
          as: 'chair',
          attributes: ['id', 'deviceId', 'display_name', 'metadata', 'lastSeenAt'],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    // Filter pairs where at least one device is online
    const onlinePairs = pairs.filter(pair => {
      // Check real-time status first (most accurate)
      const vrOnlineRealtime = pair.vr?.deviceId ? deviceDiscoveryService.isDeviceOnline(pair.vr.deviceId) : false;
      const chairOnlineRealtime = pair.chair?.deviceId ? deviceDiscoveryService.isDeviceOnline(pair.chair.deviceId) : false;

      // Fallback to database timestamp
      const vrOnlineDb = pair.vr?.lastSeenAt && new Date(pair.vr.lastSeenAt) > onlineThreshold;
      const chairOnlineDb = pair.chair?.lastSeenAt && new Date(pair.chair.lastSeenAt) > onlineThreshold;

      // Device is online if either real-time or DB check passes
      const vrOnline = vrOnlineRealtime || vrOnlineDb;
      const chairOnline = chairOnlineRealtime || chairOnlineDb;

      return vrOnline || chairOnline;
    });

    // Add online status to each pair
    return onlinePairs.map(pair => {
      const vrOnlineRealtime = pair.vr?.deviceId ? deviceDiscoveryService.isDeviceOnline(pair.vr.deviceId) : false;
      const chairOnlineRealtime = pair.chair?.deviceId ? deviceDiscoveryService.isDeviceOnline(pair.chair.deviceId) : false;

      const vrOnlineDb = pair.vr?.lastSeenAt && new Date(pair.vr.lastSeenAt) > onlineThreshold;
      const chairOnlineDb = pair.chair?.lastSeenAt && new Date(pair.chair.lastSeenAt) > onlineThreshold;

      const vrOnline = vrOnlineRealtime || vrOnlineDb;
      const chairOnline = chairOnlineRealtime || chairOnlineDb;

      return {
        ...pair.toJSON(),
        vrOnline,
        chairOnline,
        bothOnline: vrOnline && chairOnline,
      };
    });
  }

  /**
   * Generate next available display name for VR device
   * @returns {Promise<string>} e.g., "VR_#001"
   */
  async generateVRDisplayName() {
    const lastDevice = await VRDevice.findOne({
      where: {
        display_name: {
          [Op.like]: 'VR_#%'
        }
      },
      order: [['display_name', 'DESC']],
    });

    let nextNumber = 1;
    if (lastDevice && lastDevice.display_name) {
      const match = lastDevice.display_name.match(/VR_#(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `VR_#${String(nextNumber).padStart(3, '0')}`;
  }

  /**
   * Generate next available display name for Chair device
   * @returns {Promise<string>} e.g., "CHAIR_#001"
   */
  async generateChairDisplayName() {
    const lastDevice = await ChairDevice.findOne({
      where: {
        display_name: {
          [Op.like]: 'CHAIR_#%'
        }
      },
      order: [['display_name', 'DESC']],
    });

    let nextNumber = 1;
    if (lastDevice && lastDevice.display_name) {
      const match = lastDevice.display_name.match(/CHAIR_#(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `CHAIR_#${String(nextNumber).padStart(3, '0')}`;
  }

  /**
   * Ensure device has a display name, generate if missing
   * @param {Object} device - VR or Chair device instance
   * @param {string} type - 'vr' or 'chair'
   * @returns {Promise<string>} display_name
   */
  async ensureDisplayName(device, type) {
    if (device.display_name) {
      return device.display_name;
    }

    const displayName = type === 'vr'
      ? await this.generateVRDisplayName()
      : await this.generateChairDisplayName();

    await device.update({ display_name: displayName });
    logger.info(`Generated display name ${displayName} for ${type} device ${device.id}`);

    return displayName;
  }
}

module.exports = DevicePairService;
