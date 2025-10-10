const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class JourneyAudioTrack extends Model {
    static associate(models) {
      this.belongsTo(models.journey, {
        foreignKey: 'journey_id',
        as: 'journey',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
      this.belongsTo(models.audio_track, {
        foreignKey: 'audio_track_id',
        as: 'audioTrack',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      });
    }
  }

  JourneyAudioTrack.init(
    {
      journey_id: DataTypes.INTEGER,
      audio_track_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      audio_url: {
        type: DataTypes.STRING,
        allowNull: false
      },
      order_index: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      title: {
        type: DataTypes.STRING,
        allowNull: true
      }
    },
    {
      sequelize,
      modelName: 'journey_audio_track',
      underscored: true,
      tableName: 'journey_audio_tracks',
    }
  );

  return JourneyAudioTrack;
};