'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('session_participants', 'current_journey_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'journeys',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('session_participants', 'current_journey_id');
  }
};
