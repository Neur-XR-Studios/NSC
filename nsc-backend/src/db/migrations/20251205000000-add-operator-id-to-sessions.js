'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add operator_id column to sessions table
    await queryInterface.addColumn('sessions', 'operator_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'The operator/user who created this session',
    });

    // Add index for faster lookups by operator
    await queryInterface.addIndex('sessions', ['operator_id'], {
      name: 'sessions_operator_id_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('sessions', 'sessions_operator_id_idx');
    await queryInterface.removeColumn('sessions', 'operator_id');
  },
};
