module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Replace video_id with journey_id and add timing/device fields
    await queryInterface.removeColumn('session_logs', 'video_id');

    await queryInterface.addColumn('session_logs', 'journey_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    await queryInterface.addColumn('session_logs', 'start_time', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('session_logs', 'end_time', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('session_logs', 'duration_ms', {
      type: Sequelize.BIGINT,
      allowNull: true,
    });

    await queryInterface.addColumn('session_logs', 'vr_device_id', {
      type: Sequelize.STRING(32),
      allowNull: true,
    });

    await queryInterface.addColumn('session_logs', 'position_ms', {
      type: Sequelize.BIGINT,
      allowNull: true,
      comment: 'Playback position when the event occurred',
    });

    await queryInterface.addColumn('session_logs', 'error_code', {
      type: Sequelize.STRING(64),
      allowNull: true,
    });

    await queryInterface.addColumn('session_logs', 'error_message', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn('session_logs', 'metadata', {
      type: Sequelize.JSON,
      allowNull: true,
    });

    // Helpful indexes for querying
    await queryInterface.addIndex('session_logs', ['session_id']);
    await queryInterface.addIndex('session_logs', ['journey_id']);
    await queryInterface.addIndex('session_logs', ['event']);
  },

  down: async (queryInterface, Sequelize) => {
    // Revert indexes first
    await queryInterface.removeIndex('session_logs', ['event']).catch(() => {});
    await queryInterface.removeIndex('session_logs', ['journey_id']).catch(() => {});
    await queryInterface.removeIndex('session_logs', ['session_id']).catch(() => {});

    // Remove added columns
    await queryInterface.removeColumn('session_logs', 'metadata');
    await queryInterface.removeColumn('session_logs', 'error_message');
    await queryInterface.removeColumn('session_logs', 'error_code');
    await queryInterface.removeColumn('session_logs', 'position_ms');
    await queryInterface.removeColumn('session_logs', 'vr_device_id');
    await queryInterface.removeColumn('session_logs', 'duration_ms');
    await queryInterface.removeColumn('session_logs', 'end_time');
    await queryInterface.removeColumn('session_logs', 'start_time');
    await queryInterface.removeColumn('session_logs', 'journey_id');

    // Restore video_id
    await queryInterface.addColumn('session_logs', 'video_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },
};
