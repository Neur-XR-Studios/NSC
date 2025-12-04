module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("device_pairs", {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.UUIDV4,
      },
      pair_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      vr_device_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
        references: {
          model: "vr_devices",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      chair_device_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
        references: {
          model: "chair_devices",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    // Add unique constraint on the combination of vr_device_id and chair_device_id
    await queryInterface.addIndex("device_pairs", ["vr_device_id", "chair_device_id"], {
      unique: true,
      name: "unique_device_pair",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("device_pairs");
  },
};
