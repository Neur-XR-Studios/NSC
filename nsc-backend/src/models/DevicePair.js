module.exports = (sequelize, DataTypes) => {
  const DevicePair = sequelize.define(
    "DevicePair",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      pair_name: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      vr_device_id: {
        type: DataTypes.STRING(128),
        allowNull: false,
      },
      chair_device_id: {
        type: DataTypes.STRING(128),
        allowNull: false,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: "device_pairs",
      timestamps: true,
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ["vr_device_id", "chair_device_id"],
          name: "unique_device_pair",
        },
      ],
    },
  );

  DevicePair.associate = (models) => {
    DevicePair.belongsTo(models.VRDevice, { foreignKey: "vr_device_id", as: "vr" });
    DevicePair.belongsTo(models.ChairDevice, { foreignKey: "chair_device_id", as: "chair" });
  };

  return DevicePair;
};
