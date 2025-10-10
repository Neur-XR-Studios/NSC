const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Telemetry extends Model {
    static associate(models) {}
  }

  Telemetry.init(
    {
      video_id: DataTypes.INTEGER, // kept separate; no FK constraint at DB level
      version: DataTypes.STRING,
      format: DataTypes.STRING,
      telemetry_url: DataTypes.STRING, // generated filename only
      checksum: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: 'telemetry',
      underscored: true,
      tableName: 'telemetry',
    }
  );

  return Telemetry;
};
