"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query("SET FOREIGN_KEY_CHECKS = 0");

    // 1. Update VRDevice and ChairDevice primary keys
    await queryInterface.changeColumn("vr_devices", "id", {
      type: Sequelize.STRING(128),
      allowNull: false,
    });
    await queryInterface.changeColumn("chair_devices", "id", {
      type: Sequelize.STRING(128),
      allowNull: false,
    });

    // 2. Update Session foreign keys
    await queryInterface.changeColumn("sessions", "vr_device_id", {
      type: Sequelize.STRING(128),
      allowNull: true,
    });
    await queryInterface.changeColumn("sessions", "chair_device_id", {
      type: Sequelize.STRING(128),
      allowNull: true,
    });

    // 3. Update DevicePair foreign keys
    await queryInterface.changeColumn("device_pairs", "vr_device_id", {
      type: Sequelize.STRING(128),
      allowNull: false,
    });
    await queryInterface.changeColumn("device_pairs", "chair_device_id", {
      type: Sequelize.STRING(128),
      allowNull: false,
    });

    // 4. Update PairingBundle foreign keys
    await queryInterface.changeColumn("pairing_bundles", "vr_device_id", {
      type: Sequelize.STRING(128),
      allowNull: true,
    });
    await queryInterface.changeColumn("pairing_bundles", "chair_device_id", {
      type: Sequelize.STRING(128),
      allowNull: true,
    });

    await queryInterface.sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query("SET FOREIGN_KEY_CHECKS = 0");

    // Revert in reverse order
    // Note: Reverting might fail if data > 32 chars exists, but that's expected for down migrations of this type.

    // 4. Revert PairingBundle
    await queryInterface.changeColumn("pairing_bundles", "vr_device_id", {
      type: Sequelize.STRING(32),
      allowNull: true,
    });
    await queryInterface.changeColumn("pairing_bundles", "chair_device_id", {
      type: Sequelize.STRING(32),
      allowNull: true,
    });

    // 3. Revert DevicePair
    await queryInterface.changeColumn("device_pairs", "vr_device_id", {
      type: Sequelize.STRING(32),
      allowNull: false,
    });
    await queryInterface.changeColumn("device_pairs", "chair_device_id", {
      type: Sequelize.STRING(32),
      allowNull: false,
    });

    // 2. Revert Session
    await queryInterface.changeColumn("sessions", "vr_device_id", {
      type: Sequelize.STRING(32),
      allowNull: true,
    });
    await queryInterface.changeColumn("sessions", "chair_device_id", {
      type: Sequelize.STRING(32),
      allowNull: true,
    });

    // 1. Revert VRDevice and ChairDevice
    await queryInterface.changeColumn("vr_devices", "id", {
      type: Sequelize.STRING(32),
      allowNull: false,
    });
    await queryInterface.changeColumn("chair_devices", "id", {
      type: Sequelize.STRING(32),
      allowNull: false,
    });

    await queryInterface.sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
  },
};
