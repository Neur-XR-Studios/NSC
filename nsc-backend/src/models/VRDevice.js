module.exports = (sequelize, DataTypes) => {
  const VRDevice = sequelize.define('VRDevice', {
    id: {
      type: DataTypes.STRING(32),
      primaryKey: true,
      allowNull: false,
      unique: true,
    },
    display_name: {
      type: DataTypes.STRING(32),
      allowNull: true,
      unique: true,
    },
    deviceId: {
      type: DataTypes.STRING(128),
      allowNull: false,
      unique: true,
    },
    registeredAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    lastSeenAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'vr_devices',
    timestamps: true,
    underscored: true,
  });

  VRDevice.associate = (models) => {
    VRDevice.hasMany(models.Session, { foreignKey: 'vr_device_id', as: 'sessions' });
  };

  return VRDevice;
};
