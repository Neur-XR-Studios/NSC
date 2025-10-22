'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Insert VR devices
    await queryInterface.bulkInsert('vr_devices', [
      {
        id: 'VR_#001',
        device_id: 'VR_#001',
        registered_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'VR_#002', 
        device_id: 'VR_#002',
        registered_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      }
    ], {
      ignoreDuplicates: true
    });

    // Insert Chair devices
    await queryInterface.bulkInsert('chair_devices', [
      {
        id: 'CHAIR_#001',
        device_id: 'CHAIR_#001',
        registered_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'CHAIR_#002',
        device_id: 'CHAIR_#002',
        registered_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      }
    ], {
      ignoreDuplicates: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('vr_devices', {
      id: ['VR_#001', 'VR_#002']
    });
    await queryInterface.bulkDelete('chair_devices', {
      id: ['CHAIR_#001', 'CHAIR_#002']
    });
  }
};
