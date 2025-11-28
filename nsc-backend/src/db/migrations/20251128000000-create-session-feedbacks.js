module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('session_feedbacks', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
      },
      session_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'sessions',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      rating: {
        type: Sequelize.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
          max: 5,
        },
      },
      feedback_text: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    // Add index on session_id for faster lookups
    await queryInterface.addIndex('session_feedbacks', ['session_id'], {
      name: 'session_feedbacks_session_id_idx',
    });

    // Add index on created_at for sorting
    await queryInterface.addIndex('session_feedbacks', ['created_at'], {
      name: 'session_feedbacks_created_at_idx',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('session_feedbacks');
  },
};
