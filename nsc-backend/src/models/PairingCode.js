module.exports = (sequelize, DataTypes) => {
  const PairingCode = sequelize.define('PairingCode', {
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
    type: {
      type: DataTypes.ENUM('vr', 'chair'),
      allowNull: false,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    claimed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    claimedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'pairing_codes',
    timestamps: true,
    underscored: true,
  });

  return PairingCode;
};
