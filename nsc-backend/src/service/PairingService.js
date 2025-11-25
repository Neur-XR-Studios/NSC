const { Op } = require('sequelize');
const { PairingCode, VRDevice, ChairDevice, IdCounter, DevicePair, PairingBundle, sequelize } = require('../models');

const CODE_TTL_MINUTES = 10;

class PairingService {
  async nextId(type, t) {
    // Ensure row exists for type
    const [row, created] = await IdCounter.findOrCreate({
      where: { type },
      defaults: { type, last_number: 0 },
      transaction: t,
    });

    // If first time creating counter for this type, seed it from existing max id
    if (created) {
      let maxNum = 0;
      if (type === 'vr') {
        const latest = await VRDevice.findOne({
          attributes: ['id'],
          order: [['id', 'DESC']],
          transaction: t,
        });
        if (latest && latest.id) {
          const m = latest.id.match(/_#(\d+)$/);
          if (m) maxNum = parseInt(m[1], 10);
        }
      } else {
        const latest = await ChairDevice.findOne({
          attributes: ['id'],
          order: [['id', 'DESC']],
          transaction: t,
        });
        if (latest && latest.id) {
          const m = latest.id.match(/_#(\d+)$/);
          if (m) maxNum = parseInt(m[1], 10);
        }
      }
      if (maxNum > 0) {
        await row.update({ last_number: maxNum }, { transaction: t });
        await row.reload({ transaction: t });
      }
    }

    // increment atomically
    await row.increment('last_number', { by: 1, transaction: t });
    await row.reload({ transaction: t });
    const num = row.last_number;
    const prefix = type === 'vr' ? 'VR' : 'CHAIR';
    return `${prefix}_#${String(num).padStart(3, '0')}`;
  }

  async generateCode(type) {
    if (!['vr', 'chair'].includes(type)) {
      throw new Error('Invalid type');
    }
    // Generate a unique 6-digit numeric code
    let code;
    for (let i = 0; i < 5; i += 1) {
      code = ('' + (Math.floor(Math.random() * 900000) + 100000));
      // eslint-disable-next-line no-await-in-loop
      const exists = await PairingCode.findOne({ where: { code, claimed: false, expiresAt: { [Op.gt]: new Date() } } });
      if (!exists) break;
      code = null;
    }
    if (!code) {
      throw new Error('Unable to generate code');
    }

    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);
    const rec = await PairingCode.create({ code, type, expiresAt, claimed: false });
    return { code: rec.code, expiresAt: rec.expiresAt };
  }

  async registerWithCode({ code, type, deviceId, metadata }) {
    const rec = await PairingCode.findOne({ where: { code, type } });
    if (!rec) throw new Error('Invalid code');
    if (rec.claimed) throw new Error('Code already used');
    if (rec.expiresAt <= new Date()) throw new Error('Code expired');

    const result = await sequelize.transaction(async (t) => {
      // Find existing by hardware deviceId
      let device;
      if (type === 'vr') {
        device = deviceId ? await VRDevice.findOne({ where: { deviceId }, transaction: t }) : null;
        if (!device) {
          // Retry loop to avoid rare duplicate key collisions
          const MAX_RETRIES = 5;
          for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
            const newId = await this.nextId('vr', t);
            const primaryId = (deviceId && deviceId.trim().length > 0)
              ? deviceId
              : newId;
            try {
              const autoDeviceId = (deviceId && deviceId.trim().length > 0)
                ? deviceId
                : newId.toLowerCase().replace('vr_', 'vr-');
              device = await VRDevice.create(
                {
                  id: primaryId,
                  deviceId: autoDeviceId,
                  display_name: metadata?.name ? `${metadata.name} (${newId})` : newId,  // Combine display name from metadata with device_id
                  metadata: metadata || null,
                  registeredAt: new Date()
                },
                { transaction: t }
              );
              break;
            } catch (err) {
              const msg = (err && err.original && err.original.sqlMessage) || err.message || '';
              if (msg.includes('Duplicate entry') || (err.name === 'SequelizeUniqueConstraintError')) {
                // try next id
                device = null;
                continue;
              }
              throw err;
            }
          }
          if (!device) throw new Error('Failed to allocate unique VR device id after retries');
        } else if (metadata) {
          await device.update({ metadata }, { transaction: t });
        }
      } else {
        device = deviceId ? await ChairDevice.findOne({ where: { deviceId }, transaction: t }) : null;
        if (!device) {
          const MAX_RETRIES = 5;
          for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
            const newId = await this.nextId('chair', t);
            const primaryId = (deviceId && deviceId.trim().length > 0)
              ? deviceId
              : newId;
            try {
              const autoDeviceId = (deviceId && deviceId.trim().length > 0)
                ? deviceId
                : newId.toLowerCase().replace('chair_', 'chair-');
              device = await ChairDevice.create(
                {
                  id: primaryId,
                  deviceId: autoDeviceId,
                  display_name: metadata?.name ? `${metadata.name} (${newId})` : newId,  // Combine display name from metadata with device_id
                  metadata: metadata || null,
                  registeredAt: new Date()
                },
                { transaction: t }
              );
              break;
            } catch (err) {
              const msg = (err && err.original && err.original.sqlMessage) || err.message || '';
              if (msg.includes('Duplicate entry') || (err.name === 'SequelizeUniqueConstraintError')) {
                device = null;
                continue;
              }
              throw err;
            }
          }
          if (!device) throw new Error('Failed to allocate unique Chair device id after retries');
        } else if (metadata) {
          await device.update({ metadata }, { transaction: t });
        }
      }

      await rec.update({ claimed: true, claimedAt: new Date() }, { transaction: t });
      return device;
    });

    return result;
  }

  /**
   * Get bundle pairing status to support frontend polling fallback
   */
  async getBundleStatus(code) {
    const bundle = await PairingBundle.findOne({ where: { code } });
    if (!bundle) throw new Error('Invalid bundle code');
    let pair = null;
    if (bundle.completed && bundle.vr_device_id && bundle.chair_device_id) {
      pair = await DevicePair.findOne({ where: { vr_device_id: bundle.vr_device_id, chair_device_id: bundle.chair_device_id } });
    }
    
    return { bundle, pair };
  }

  /**
   * Generate a shared bundle code to pair VR + Chair simultaneously
   */
  async generateBundleCode(opts = {}) {
    const { target_pair_id = null } = opts || {};
    // 6-digit unique code
    let code;
    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const c = ('' + (Math.floor(Math.random() * 900000) + 100000));
      // eslint-disable-next-line no-await-in-loop
      const exists = await PairingBundle.findOne({ where: { code: c, completed: false, expiresAt: { [Op.gt]: new Date() } } });
      if (!exists) {
        code = c;
        break;
      }
    }
    if (!code) throw new Error('Unable to generate code');

    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);
    const rec = await PairingBundle.create({ code, expiresAt, completed: false, target_pair_id });
    return { code: rec.code, expiresAt: rec.expiresAt };
  }

  /**
   * Register a device using a bundle code. When both types are present, auto-create DevicePair.
   * Emits Socket.IO events: pairing:progress and pairing:complete
   */
  async registerWithBundle({ bundleCode, type, deviceId, metadata }) {
    const bundle = await PairingBundle.findOne({ where: { code: bundleCode } });
    if (!bundle) throw new Error('Invalid bundle code');
    if (bundle.expiresAt <= new Date()) throw new Error('Bundle code expired');
    if (bundle.completed) throw new Error('Bundle already completed');

    const result = await sequelize.transaction(async (t) => {
      // Create or update device by physical deviceId
      let device;
      if (type === 'vr') {
        device = await VRDevice.findOne({ where: { deviceId }, transaction: t });
        if (!device) {
          const newId = await this.nextId('vr', t);
          const primaryId = (deviceId && deviceId.trim().length > 0)
            ? deviceId
            : newId;
          const autoDeviceId = (deviceId && deviceId.trim().length > 0)
            ? deviceId
            : newId.toLowerCase().replace('vr_', 'vr-');
          device = await VRDevice.create(
            {
              id: primaryId,
              deviceId: autoDeviceId,
              display_name: newId,  // Set display_name to VR_#001 format
              metadata: metadata || null,
              registeredAt: new Date()
            },
            { transaction: t }
          );
        } else if (metadata) {
          await device.update({ metadata }, { transaction: t });
        }
        await bundle.update({ vr_device_id: device.id }, { transaction: t });
      } else if (type === 'chair') {
        device = deviceId ? await ChairDevice.findOne({ where: { deviceId }, transaction: t }) : null;
        if (!device) {
          const newId = await this.nextId('chair', t);
          const primaryId = (deviceId && deviceId.trim().length > 0)
            ? deviceId
            : newId;
          const autoDeviceId = (deviceId && deviceId.trim().length > 0)
            ? deviceId
            : newId.toLowerCase().replace('chair_', 'chair-');
          device = await ChairDevice.create(
            {
              id: primaryId,
              deviceId: autoDeviceId,
              display_name: newId,  // Set display_name to CHAIR_#001 format
              metadata: metadata || null,
              registeredAt: new Date()
            },
            { transaction: t }
          );
        } else if (metadata) {
          await device.update({ metadata }, { transaction: t });
        }
        await bundle.update({ chair_device_id: device.id }, { transaction: t });
      } else {
        throw new Error('Invalid type');
      }

      // Emit progress
      try { global.io?.emit('pairing:progress', { code: bundle.code, vr_device_id: bundle.vr_device_id, chair_device_id: bundle.chair_device_id }); } catch { }

      // If both present, create DevicePair if not existing
      await bundle.reload({ transaction: t });
      let devicePair = null;
      if (bundle.vr_device_id && bundle.chair_device_id) {
        if (bundle.target_pair_id) {
          // Update existing pair in-place (re-pair flow)
          devicePair = await DevicePair.findByPk(bundle.target_pair_id, { transaction: t });
          if (!devicePair) throw new Error('Target pair not found');
          await devicePair.update({
            vr_device_id: bundle.vr_device_id,
            chair_device_id: bundle.chair_device_id,
            is_active: true,
          }, { transaction: t });
        } else {
          // Ensure not already paired together
          devicePair = await DevicePair.findOne({ where: { vr_device_id: bundle.vr_device_id, chair_device_id: bundle.chair_device_id }, transaction: t });
          if (!devicePair) {
            devicePair = await DevicePair.create({
              pair_name: `Pair ${bundle.vr_device_id}-${bundle.chair_device_id}`,
              vr_device_id: bundle.vr_device_id,
              chair_device_id: bundle.chair_device_id,
              is_active: true,
            }, { transaction: t });
          }
        }
        await bundle.update({ completed: true, completedAt: new Date() }, { transaction: t });
        try { global.io?.emit('pairing:complete', { code: bundle.code, pair: devicePair }); } catch { }
      }

      return { bundle, device, devicePair };
    });

    return result;
  }

  async listDevices() {
    const [vrs, chairs] = await Promise.all([
      VRDevice.findAll({ order: [['createdAt', 'DESC']] }),
      ChairDevice.findAll({ order: [['createdAt', 'DESC']] }),
    ]);
    return { vr: vrs, chairs };
  }
}

module.exports = PairingService;