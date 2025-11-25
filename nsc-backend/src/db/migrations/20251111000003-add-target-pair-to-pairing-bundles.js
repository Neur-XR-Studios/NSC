module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('pairing_bundles', 'target_pair_id', {
      type: Sequelize.UUID,
      allowNull: true,
      after: 'completed_at',
    });
    await queryInterface.addIndex('pairing_bundles', ['target_pair_id']);
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('pairing_bundles', ['target_pair_id']);
    await queryInterface.removeColumn('pairing_bundles', 'target_pair_id');
  },
};
