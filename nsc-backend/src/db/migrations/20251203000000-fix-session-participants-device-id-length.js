"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query("SET FOREIGN_KEY_CHECKS = 0");

    // Update session_participants device ID columns to match the increased length
    await queryInterface.changeColumn("session_participants", "vr_device_id", {
      type: Sequelize.STRING(128),
      allowNull: true,
    });
    await queryInterface.changeColumn("session_participants", "chair_device_id", {
      type: Sequelize.STRING(128),
      allowNull: true,
    });

    // Update session_logs vr_device_id column
    await queryInterface.changeColumn("session_logs", "vr_device_id", {
      type: Sequelize.STRING(128),
      allowNull: true,
    });

    await queryInterface.sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query("SET FOREIGN_KEY_CHECKS = 0");

    await queryInterface.changeColumn("session_participants", "vr_device_id", {
      type: Sequelize.STRING(32),
      allowNull: true,
    });
    await queryInterface.changeColumn("session_participants", "chair_device_id", {
      type: Sequelize.STRING(32),
      allowNull: true,
    });
    await queryInterface.changeColumn("session_logs", "vr_device_id", {
      type: Sequelize.STRING(32),
      allowNull: true,
    });

    await queryInterface.sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
  },
};
