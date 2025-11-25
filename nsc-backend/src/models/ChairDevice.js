module.exports = (sequelize, DataTypes) => {
  const ChairDevice = sequelize.define('ChairDevice', {
    id: {
      type: DataTypes.STRING(32),
      primaryKey: true,
      allowNull: false,
    },
    display_name: {
      type: DataTypes.STRING(32),
      allowNull: true,
      unique: true,
    },
    deviceId: { // hardware-reported unique id
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
    tableName: 'chair_devices',
    timestamps: true,
    underscored: true,
  });

  ChairDevice.associate = (models) => {
    ChairDevice.hasMany(models.Session, { foreignKey: 'chair_device_id', as: 'sessions' });
  };

  return ChairDevice;
};
