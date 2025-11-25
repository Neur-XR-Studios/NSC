module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('pairing_bundles', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('(UUID())'),
      },
      code: {
        type: Sequelize.STRING(6),
        allowNull: false,
        unique: true,
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      vr_device_id: {
        type: Sequelize.STRING(32),
        allowNull: true,
      },
      chair_device_id: {
        type: Sequelize.STRING(32),
        allowNull: true,
      },
      completed: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });
    await queryInterface.addIndex('pairing_bundles', ['code']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('pairing_bundles');
  },
};
