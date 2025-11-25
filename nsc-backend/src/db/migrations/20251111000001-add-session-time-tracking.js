module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add session time tracking fields
    await queryInterface.addColumn('sessions', 'started_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('sessions', 'paused_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('sessions', 'stopped_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('sessions', 'total_duration_ms', {
      type: Sequelize.BIGINT,
      allowNull: true,
      defaultValue: 0,
      comment: 'Total duration in milliseconds (excluding paused time)',
    });

    await queryInterface.addColumn('sessions', 'pause_duration_ms', {
      type: Sequelize.BIGINT,
      allowNull: true,
      defaultValue: 0,
      comment: 'Total time spent in paused state in milliseconds',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('sessions', 'started_at');
    await queryInterface.removeColumn('sessions', 'paused_at');
    await queryInterface.removeColumn('sessions', 'stopped_at');
    await queryInterface.removeColumn('sessions', 'total_duration_ms');
    await queryInterface.removeColumn('sessions', 'pause_duration_ms');
  },
};
