module.exports = (sequelize, DataTypes) => {
  const IdCounter = sequelize.define('IdCounter', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    type: {
      type: DataTypes.ENUM('vr', 'chair'),
      allowNull: false,
      unique: true,
    },
    last_number: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  }, {
    tableName: 'id_counters',
    timestamps: false,
    underscored: true,
  });

  return IdCounter;
};
