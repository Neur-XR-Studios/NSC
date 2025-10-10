const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Video extends Model {
    static associate(models) {}
  }

  Video.init(
    {
      title: DataTypes.STRING,
      description: DataTypes.TEXT,
      duration_ms: DataTypes.INTEGER,
      video_url: DataTypes.STRING, // stores only generated filename
      original_name: DataTypes.STRING,
      mime_type: DataTypes.STRING,
      thumbnail_url: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: 'video',
      underscored: true,
      tableName: 'videos',
    }
  );

  return Video;
};
