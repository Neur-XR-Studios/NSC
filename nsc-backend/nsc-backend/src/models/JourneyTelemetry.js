const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class JourneyTelemetry extends Model {
    static associate(models) {}
  }

  JourneyTelemetry.init(
    {
      journey_id: DataTypes.INTEGER,
      telemetry_id: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: 'journey_telemetry',
      underscored: true,
      tableName: 'journey_telemetry',
    }
  );

  return JourneyTelemetry;
};
