module.exports = (sequelize, DataTypes) => {
  const PairingBundle = sequelize.define(
    "PairingBundle",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      code: {
        type: DataTypes.STRING(6),
        allowNull: false,
        unique: true,
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      vr_device_id: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      chair_device_id: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      completed: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      completedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      target_pair_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
    },
    {
      tableName: "pairing_bundles",
      timestamps: true,
      underscored: true,
    },
  );

  return PairingBundle;
};
