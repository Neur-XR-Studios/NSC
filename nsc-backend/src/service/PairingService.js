const { Op } = require('sequelize');
const { PairingCode, VRDevice, ChairDevice, IdCounter, sequelize } = require('../models');

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
        device = await VRDevice.findOne({ where: { deviceId }, transaction: t });
        if (!device) {
          // Retry loop to avoid rare duplicate key collisions
          const MAX_RETRIES = 5;
          for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
            const newId = await this.nextId('vr', t);
            try {
              device = await VRDevice.create(
                { id: newId, deviceId, metadata: metadata || null, registeredAt: new Date() },
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
        device = await ChairDevice.findOne({ where: { deviceId }, transaction: t });
        if (!device) {
          const MAX_RETRIES = 5;
          for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
            const newId = await this.nextId('chair', t);
            try {
              device = await ChairDevice.create(
                { id: newId, deviceId, metadata: metadata || null, registeredAt: new Date() },
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

  async listDevices() {
    const [vrs, chairs] = await Promise.all([
      VRDevice.findAll({ order: [['createdAt', 'DESC']] }),
      ChairDevice.findAll({ order: [['createdAt', 'DESC']] }),
    ]);
    return { vr: vrs, chairs };
  }
}

module.exports = PairingService;
