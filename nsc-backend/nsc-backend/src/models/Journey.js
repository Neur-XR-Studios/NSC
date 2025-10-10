const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Journey extends Model {
    static associate(models) {}
  }

  Journey.init(
    {
      title: DataTypes.STRING,
      description: DataTypes.TEXT,
      video_id: DataTypes.INTEGER,
      audio_track_id: DataTypes.INTEGER,
      telemetry_id: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: 'journey',
      underscored: true,
      tableName: 'journeys',
    }
  );

  Journey.associate = (models) => {
    // Associations can be added here if needed
  };

  return Journey;
};
